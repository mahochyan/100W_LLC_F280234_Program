[CmdletBinding()]
param(
    [ValidateRange(1, 100)]
    [int]$Attempts = 20,

    [ValidateRange(0, 5000)]
    [int]$DelayMs = 100
)

$ErrorActionPreference = "Stop"
$compositeId = "USB\VID_0403&PID_A6D0\XDS100V2"
$debugPrefix = "USB\VID_0403&PID_A6D0&MI_00\"
$auxPrefix = "USB\VID_0403&PID_A6D0&MI_01\"
$serialTool = "D:\CCS21\ccs\ccs_base\common\uscif\xds100serial.exe"
$residualProcessPattern =
    "^(dss|java|javaw|DebugServer|ccstudio|eclipse|eclipsec|DSLite|cl2000|lnk2000)$"

function Test-PresentOk {
    param([object]$Device)
    return $null -ne $Device -and $Device.Present -eq $true -and
        $Device.Status -eq "OK"
}

function Get-DevicePropertyData {
    param(
        [string]$InstanceId,
        [string]$KeyName
    )

    if ([string]::IsNullOrWhiteSpace($InstanceId)) {
        return $null
    }

    try {
        return (Get-PnpDeviceProperty -InstanceId $InstanceId `
            -KeyName $KeyName -ErrorAction Stop).Data
    } catch {
        return $null
    }
}

function Convert-ArrivalToStableText {
    param([object]$Value)

    if ($Value -is [datetime]) {
        return $Value.ToUniversalTime().ToString(
            "o", [System.Globalization.CultureInfo]::InvariantCulture)
    }
    if ($null -eq $Value) {
        return ""
    }
    return [Convert]::ToString(
        $Value, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-XdsSnapshot {
    $allDevices = @(Get-PnpDevice -ErrorAction Stop)
    $compositeCandidates = @($allDevices | Where-Object {
        $_.InstanceId -ieq $compositeId -and (Test-PresentOk $_)
    })
    $debugCandidates = @($allDevices | Where-Object {
        $_.InstanceId.StartsWith(
            $debugPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
            (Test-PresentOk $_)
    })
    $auxCandidates = @($allDevices | Where-Object {
        $_.InstanceId.StartsWith(
            $auxPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
            (Test-PresentOk $_)
    })

    $composite = $compositeCandidates | Select-Object -First 1
    $debugPort = $debugCandidates | Select-Object -First 1
    $auxPort = $auxCandidates | Select-Object -First 1

    $compositeParentId = Get-DevicePropertyData $composite.InstanceId `
        "DEVPKEY_Device_Parent"
    $debugParentId = Get-DevicePropertyData $debugPort.InstanceId `
        "DEVPKEY_Device_Parent"
    $auxParentId = Get-DevicePropertyData $auxPort.InstanceId `
        "DEVPKEY_Device_Parent"
    $parentCandidates = @($allDevices | Where-Object {
        $_.InstanceId -ieq $compositeParentId -and (Test-PresentOk $_)
    })
    $parent = $parentCandidates | Select-Object -First 1

    $topologyOk = $null -ne $compositeParentId -and
        $compositeParentId -match '(?i)^USB\\(?:VID_05E3&PID_0610\\|ROOT_HUB(?:20|30)?\\)' -and
        $debugParentId -ieq $compositeId -and
        $auxParentId -ieq $compositeId

    $compositeArrival = Get-DevicePropertyData $composite.InstanceId `
        "DEVPKEY_Device_LastArrivalDate"
    $debugArrival = Get-DevicePropertyData $debugPort.InstanceId `
        "DEVPKEY_Device_LastArrivalDate"
    $auxArrival = Get-DevicePropertyData $auxPort.InstanceId `
        "DEVPKEY_Device_LastArrivalDate"
    $parentArrival = Get-DevicePropertyData $parent.InstanceId `
        "DEVPKEY_Device_LastArrivalDate"
    $arrivalsOk = $null -ne $compositeArrival -and
        $null -ne $debugArrival -and $null -ne $auxArrival -and
        $null -ne $parentArrival

    $nodesUniqueAndPresent = $compositeCandidates.Count -eq 1 -and
        $debugCandidates.Count -eq 1 -and $auxCandidates.Count -eq 1 -and
        $parentCandidates.Count -eq 1
    $valid = $nodesUniqueAndPresent -and $topologyOk -and $arrivalsOk
    $fingerprintParts = @(
        $composite.InstanceId,
        (Convert-ArrivalToStableText $compositeArrival),
        $debugPort.InstanceId,
        (Convert-ArrivalToStableText $debugArrival),
        $auxPort.InstanceId,
        (Convert-ArrivalToStableText $auxArrival),
        $parent.InstanceId,
        (Convert-ArrivalToStableText $parentArrival)
    )

    return [pscustomobject]@{
        Valid = $valid
        TopologyOk = $topologyOk
        CompositeId = $composite.InstanceId
        DebugId = $debugPort.InstanceId
        AuxId = $auxPort.InstanceId
        ParentId = $parent.InstanceId
        Fingerprint = $fingerprintParts -join "|"
    }
}

function Get-ResidualProcesses {
    return @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match $residualProcessPattern
    })
}

$initial = Get-XdsSnapshot
Write-Output "XDS_COMPOSITE_INSTANCE=$($initial.CompositeId)"
Write-Output "XDS_DEBUG_INSTANCE=$($initial.DebugId)"
Write-Output "XDS_AUX_INSTANCE=$($initial.AuxId)"
Write-Output "XDS_PARENT_INSTANCE=$($initial.ParentId)"
Write-Output "XDS_INITIAL_TOPOLOGY_OK=$(($initial.TopologyOk).ToString().ToUpperInvariant())"
Write-Output "XDS_INITIAL_PNP_VALID=$(($initial.Valid).ToString().ToUpperInvariant())"

$residualStart = Get-ResidualProcesses
$processStartOk = $residualStart.Count -eq 0
Write-Output "XDS_RESIDUAL_PROCESS_COUNT_START=$($residualStart.Count)"

$serialToolPresent = Test-Path -LiteralPath $serialTool -PathType Leaf
$requiredAttemptsOk = $Attempts -ge 20
$serialPasses = 0
$pnpStablePasses = 0
$lastScan = ""
$baselineFingerprint = $initial.Fingerprint

if ($serialToolPresent) {
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $before = Get-XdsSnapshot
        $beforeStable = $initial.Valid -and $before.Valid -and
            $before.Fingerprint -ceq $baselineFingerprint

        $scanLines = @(& $serialTool 2>&1)
        $scanExit = $LASTEXITCODE
        $scanText = $scanLines -join [Environment]::NewLine
        $lastScan = ($scanLines -join " ").Trim()
        $enumerationRows = @($scanLines | Where-Object {
            ([string]$_) -match '(?i)^\s*0403/a6d0\s+\S+\s+XDS100V2(?:\s|$)'
        })

        $after = Get-XdsSnapshot
        $afterStable = $after.Valid -and
            $after.Fingerprint -ceq $baselineFingerprint
        if ($beforeStable -and $afterStable) {
            $pnpStablePasses++
        }

        $enumerated = $scanExit -eq 0 -and
            $scanText -notmatch '(?i)No XDS100 emulators' -and
            $scanText -notmatch '(?i)Error\s+#[^\r\n]*\boccurred\b' -and
            $enumerationRows.Count -eq 1
        if ($enumerated) {
            $serialPasses++
        }

        if ($attempt -lt $Attempts -and $DelayMs -gt 0) {
            Start-Sleep -Milliseconds $DelayMs
        }
    }
}

$final = Get-XdsSnapshot
$finalStable = $initial.Valid -and $final.Valid -and
    $final.Fingerprint -ceq $baselineFingerprint
$residualEnd = Get-ResidualProcesses
$processEndOk = $residualEnd.Count -eq 0

Write-Output "XDS100SERIAL_TOOL_PRESENT=$(($serialToolPresent).ToString().ToUpperInvariant())"
Write-Output "XDS_REQUIRED_ATTEMPTS_OK=$(($requiredAttemptsOk).ToString().ToUpperInvariant())"
Write-Output "XDS100SERIAL_ENUMERATED=$serialPasses/$Attempts"
Write-Output "XDS_PNP_STABLE_CHECKS=$pnpStablePasses/$Attempts"
Write-Output "XDS_FINAL_PNP_STABLE=$(($finalStable).ToString().ToUpperInvariant())"
Write-Output "XDS_RESIDUAL_PROCESS_COUNT_END=$($residualEnd.Count)"
if ($serialPasses -ne $Attempts) {
    Write-Output "XDS100SERIAL_LAST_SCAN=$lastScan"
}

$passed = $serialToolPresent -and $requiredAttemptsOk -and
    $processStartOk -and $processEndOk -and
    $serialPasses -eq $Attempts -and $pnpStablePasses -eq $Attempts -and
    $finalStable
if ($passed) {
    Write-Output "SOL_XDS100_STABILITY_GATE=PASS"
    exit 0
}

Write-Output "SOL_XDS100_STABILITY_GATE=FAIL"
exit 1
