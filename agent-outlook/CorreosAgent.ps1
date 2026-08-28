param(
  [string]$ConfigPath = "$PSScriptRoot\CorreosAgent.local.psd1",
  [switch]$Run,
  [ValidateRange(1, 100)]
  [int]$Limit = 100
)

$ErrorActionPreference = 'Stop'
$crmCodePattern = '\[CRM-(?:CAMP|CLI)-[A-Z0-9-]+\]'
$agentErrorLogPath = Join-Path $PSScriptRoot 'CorreosAgent-errors.log'

trap {
  $detail = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $($_ | Out-String)"
  Add-Content -LiteralPath $agentErrorLogPath -Value $detail -Encoding utf8
  exit 1
}

function Get-OutlookApplication {
  try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
  catch {
    # No cambia perfiles, cuentas ni reglas: solo inicia el Outlook de escritorio ya instalado.
    try { Start-Process -FilePath 'outlook.exe' -ErrorAction Stop | Out-Null }
    catch { throw 'No se pudo abrir Outlook de escritorio. Verifica que Outlook esté instalado en esta PC.' }

    $deadline = (Get-Date).AddSeconds(60)
    do {
      Start-Sleep -Seconds 2
      try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
      catch { }
    } while ((Get-Date) -lt $deadline)

    throw 'Outlook se abrió, pero no quedó listo en 60 segundos. Abre la aplicación, completa cualquier aviso pendiente y el agente volverá a intentarlo.'
  }
}

function Invoke-CrmApi([string]$Method, [string]$Path, $Body = $null) {
  $headers = @{ 'x-correos-agent-token' = $script:cfg.AgentToken }
  $params = @{ Method = $Method; Uri = ($script:cfg.CrmUrl.TrimEnd('/') + $Path); Headers = $headers; TimeoutSec = 30 }
  if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 8) }
  Invoke-RestMethod @params
}

function Get-OutlookAccount($namespace, [string]$Mailbox) {
  foreach ($account in @($namespace.Accounts)) {
    if ($account.SmtpAddress -eq $Mailbox -or $account.DisplayName -eq $Mailbox) { return $account }
  }
  throw "No se encontro en Outlook la cuenta configurada para Correos: $Mailbox"
}

function New-MailItemForAccount($Account) {
  # El mensaje nace dentro del buzón configurado, no en la cuenta predeterminada de Outlook.
  $drafts = $Account.DeliveryStore.GetDefaultFolder(16)
  return $drafts.Items.Add('IPM.Note')
}

function Get-OutlookFolder($Parent, [string]$Name) {
  try { return $Parent.Folders.Item($Name) }
  catch { return $Parent.Folders.Add($Name) }
}

function Get-CampaignFolder($inbox, $folderName) {
  $campaign = Get-OutlookFolder $inbox 'Email de campana'
  Get-OutlookFolder $campaign $folderName
}

function Get-CrmSubject([string]$Subject, [string]$CampaignCode) {
  $clean = $Subject.Trim()
  if ($clean -match $crmCodePattern) { return $clean }
  if (!$CampaignCode) { throw 'La campaña no tiene código CRM para identificar el envío.' }
  return "$clean [$CampaignCode]".Trim()
}

function Get-ReplyClassification([string]$text) {
  $value = $text.ToLowerInvariant()
  if ($value -match 'no deseo|no quiero|no contactar|darme de baja|elimin') { return @{ event='no_contact'; folder='No contactar / baja' } }
  if ($value -match 'reunion|reunirnos|llamada|agend|disponib') { return @{ event='meeting'; folder='Reunion / llamada agendada' } }
  if ($value -match 'me interesa|interesad|propuesta|cotizacion') { return @{ event='interested'; folder='Interesados' } }
  @{ event='pending_review'; folder='Pendientes de responder' }
}

if (!(Test-Path -LiteralPath $ConfigPath)) { throw "Falta el archivo local de configuración: $ConfigPath" }
$script:cfg = Import-PowerShellDataFile -LiteralPath $ConfigPath
$agentToken = $cfg.AgentToken
if (!$agentToken) { $agentToken = [Environment]::GetEnvironmentVariable('CORREOS_AGENT_TOKEN','User') }
if (!$cfg.CrmUrl -or !$agentToken -or !$cfg.Mailbox) { throw 'La configuración local requiere CrmUrl, AgentToken y Mailbox.' }
$script:cfg.AgentToken = $agentToken

$outlook = Get-OutlookApplication
$namespace = $outlook.GetNamespace('MAPI')
$mailAccount = Get-OutlookAccount $namespace $cfg.Mailbox

# La cola contiene como máximo el límite CRM; el valor operativo se configura en la campaña.
$queue = Invoke-CrmApi 'GET' "/api/correos/agent/queue?limit=$Limit"
foreach ($item in @($queue.data)) {
  $mail = New-MailItemForAccount $mailAccount
  $mail.SendUsingAccount = $mailAccount
  $mail.To = $item.recipient_email
  $crmSubject = Get-CrmSubject $item.subject_template $item.campaign_code
  $mail.Subject = $crmSubject
  $mail.HTMLBody = $item.html_template
  if ($Run) {
    try { $mail.Send() }
    catch {
      $failedEvent = @{ outlook_entry_id = "local-failed-$($item.recipient_id)"; event_type='failed'; campaign_id=$item.campaign_id; client_id=$item.client_id; recipient_id=$item.recipient_id; subject=$crmSubject; details=@{ error=$_.Exception.Message } }
      Invoke-CrmApi 'POST' '/api/correos/agent/events' $failedEvent | Out-Null
      continue
    }
  }
  $event = @{ outlook_entry_id = "local-$($item.recipient_id)-$($mail.EntryID)"; event_type='sent'; campaign_id=$item.campaign_id; client_id=$item.client_id; recipient_id=$item.recipient_id; subject=$crmSubject; details=@{ dry_run = (-not $Run) } }
  if ($Run) { Invoke-CrmApi 'POST' '/api/correos/agent/events' $event | Out-Null }
}

# Solo respuestas con identificador CRM se mueven a Email de campaña; los demás mensajes no se tocan.
$inbox = $mailAccount.DeliveryStore.GetDefaultFolder(6)
foreach ($message in @($inbox.Items)) {
  if ($message.Class -ne 43 -or $message.Subject -notmatch $crmCodePattern) { continue }
  $code = $Matches[0].Trim('[', ']')
  $tracking = Invoke-CrmApi 'GET' ('/api/correos/agent/tracking/' + $code)
  if (!$tracking.ok) { continue }
  $classification = Get-ReplyClassification ($message.Subject + ' ' + $message.Body)
  $target = Get-CampaignFolder $inbox $classification.folder
  $event = @{ outlook_entry_id=$message.EntryID; event_type=$classification.event; campaign_id=$tracking.data.campaign_id; client_id=$tracking.data.client_id; draft_id=$tracking.data.draft_id; subject=$message.Subject; details=@{ sender=$message.SenderEmailAddress } }
  if ($Run) { Invoke-CrmApi 'POST' '/api/correos/agent/events' $event | Out-Null; $message.Move($target) | Out-Null }
}
