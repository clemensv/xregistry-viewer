# Stop any existing nx serve processes
Write-Host "Stopping existing nx serve processes..."
$nxServeProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*nx serve*" }
if ($nxServeProcesses) {
    $nxServeProcesses | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force
            Write-Host "Stopped process with ID: $($_.Id)"
        } catch {
            Write-Host "Failed to stop process with ID: $($_.Id)"
        }
    }
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Check if port 4200 is in use
$portInUse = $false
try {
    $tcpConnection = New-Object System.Net.Sockets.TcpClient('localhost', 4200)
    $tcpConnection.Close()
    $portInUse = $true
} catch {}

if ($portInUse) {
    Write-Host "Port 4200 is in use. Starting server on port 4210..."
    $port = 4210
} else {
    Write-Host "Port 4200 is free. Starting server on default port..."
    $port = 4200
}

# Start the development server
Write-Host "Starting development server on port $port..."
npx nx serve --port=$port
