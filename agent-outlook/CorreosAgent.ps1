param(
  [string]$ConfigPath = "$PSScriptRoot\CorreosAgent.local.psd1",
  [switch]$Run
)

$ErrorActionPreference = 'Stop'
$crmCodePattern = '\[CRM-(?:CAMP|CLI)-[A-Z0-9-]+\]'

function Get-OutlookApplication {
  try { return [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
  catch { return New-Object -ComObject Outlook.Application }
}

function Invoke-CrmApi([string]$Method, [string]$Path, $Body = $null) {
  $headers = @{ 'x-correos-agent-token' = $script:cfg.AgentToken }
  $params = @{ Method = $Method; Uri = ($script:cfg.CrmUrl.TrimEnd('/') + $Path); Headers = $headers }
  if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 8) }
  Invoke-RestMethod @params
}

function Get-CampaignFolder($namespace, $storeName, $folderName) {
  $store = $namespace.Folders.Item($storeName)
  $campaign = $store.Folders.Item('Inbox').Folders.Item('Email de campaña')
  $campaign.Folders.Item($folderName)
}

function Get-ReplyClassification([string]$text) {
  $value = $text.ToLowerInvariant()
  if ($value -match 'no deseo|no quiero|no contactar|darme de baja|elimin') { return @{ event='no_contact'; folder='No contactar / baja' } }
  if ($value -match 'reunion|reunirnos|llamada|agend|disponib') { return @{ event='meeting'; folder='Reunión / llamada agendada' } }
  if ($value -match 'me interesa|interesad|propuesta|cotizacion') { return @{ event='interested'; folder='Interesados' } }
  @{ event='pending_review'; folder='Pendientes de responder' }
}

if (!(Test-Path -LiteralPath $ConfigPath)) { throw "Falta el archivo local de configuración: $ConfigPath" }
$script:cfg = Import-PowerShellDataFile -LiteralPath $ConfigPath
if (!$cfg.CrmUrl -or !$cfg.AgentToken -or !$cfg.Mailbox) { throw 'La configuración local requiere CrmUrl, AgentToken y Mailbox.' }

$outlook = Get-OutlookApplication
$namespace = $outlook.GetNamespace('MAPI')

# La cola contiene como máximo el límite CRM; el valor operativo se configura en la campaña.
$queue = Invoke-CrmApi 'GET' '/api/correos/agent/queue?limit=100'
foreach ($item in @($queue.data)) {
  $mail = $outlook.CreateItem(0)
  $mail.To = $item.recipient_email
  $mail.Subject = $item.subject_template
  $mail.HTMLBody = $item.html_template
  if ($Run) { $mail.Send() }
  $event = @{ outlook_entry_id = "local-$($item.recipient_id)-$($mail.EntryID)"; event_type='sent'; campaign_id=$item.campaign_id; client_id=$item.client_id; recipient_id=$item.recipient_id; subject=$mail.Subject; details=@{ dry_run = (-not $Run) } }
  if ($Run) { Invoke-CrmApi 'POST' '/api/correos/agent/events' $event | Out-Null }
}

# Solo respuestas con identificador CRM se mueven a Email de campaña; los demás mensajes no se tocan.
$inbox = $namespace.Folders.Item($cfg.Mailbox).Folders.Item('Inbox')
foreach ($message in @($inbox.Items)) {
  if ($message.Class -ne 43 -or $message.Subject -notmatch $crmCodePattern) { continue }
  $code = $Matches[0].Trim('[', ']')
  $tracking = Invoke-CrmApi 'GET' ('/api/correos/agent/tracking/' + $code)
  if (!$tracking.ok) { continue }
  $classification = Get-ReplyClassification ($message.Subject + ' ' + $message.Body)
  $target = Get-CampaignFolder $namespace $cfg.Mailbox $classification.folder
  $event = @{ outlook_entry_id=$message.EntryID; event_type=$classification.event; campaign_id=$tracking.data.campaign_id; client_id=$tracking.data.client_id; draft_id=$tracking.data.draft_id; subject=$message.Subject; details=@{ sender=$message.SenderEmailAddress } }
  if ($Run) { Invoke-CrmApi 'POST' '/api/correos/agent/events' $event | Out-Null; $message.Move($target) | Out-Null }
}
