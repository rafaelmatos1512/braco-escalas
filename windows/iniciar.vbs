' Braço e Escalas: abre o app.
' Liga o servidor escondido (sem janela preta), se ainda não estiver ligado, e abre o Chrome em janela de aplicativo.
' Os caminhos do Python e do ffmpeg vêm de python.txt e ffmpeg.txt, escritos pelo instalar.ps1.
Option Explicit
Dim sh, fso, aqui, app, url, dados, py, ff, chrome, c, cc, i

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
aqui = fso.GetParentFolderName(WScript.ScriptFullName)
app = fso.GetParentFolderName(aqui)
url = "http://localhost:5173/"
dados = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BracoEscalas\dados"

Function Ler(nome)
  Ler = ""
  If fso.FileExists(aqui & "\" & nome) Then
    Dim f: Set f = fso.OpenTextFile(aqui & "\" & nome, 1)
    If Not f.AtEndOfStream Then Ler = Trim(f.ReadLine)
    f.Close
  End If
End Function

Function Ligado()
  Dim h
  Ligado = False
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 1500, 1500, 1500, 1500
  h.open "GET", url & "api/estado", False
  h.send
  If Err.Number = 0 Then Ligado = (h.status = 200)
  On Error GoTo 0
End Function

If Not Ligado() Then
  py = Ler("python.txt")
  If py = "" Or Not fso.FileExists(py) Then
    MsgBox "Não encontrei o Python neste computador." & vbCrLf & vbCrLf & _
      "Rode de novo o arquivo instalar.bat, na pasta windows do Braço e Escalas.", vbExclamation, "Braço e Escalas"
    WScript.Quit 1
  End If
  sh.Environment("Process")("BRACO_DADOS") = dados
  ff = Ler("ffmpeg.txt")
  If ff <> "" Then sh.Environment("Process")("BRACO_FFMPEG") = ff
  sh.CurrentDirectory = app
  sh.Run """" & py & """ """ & app & "\serve.py""", 0, False
  For i = 1 To 60
    WScript.Sleep 250
    If Ligado() Then Exit For
  Next
  If Not Ligado() Then
    MsgBox "O Braço e Escalas não conseguiu ligar." & vbCrLf & vbCrLf & _
      "Reinicie o computador e tente de novo. Se continuar, veja o arquivo:" & vbCrLf & dados & "\servidor.log", vbExclamation, "Braço e Escalas"
    WScript.Quit 1
  End If
End If

chrome = ""
For Each c In Array("%ProgramFiles%\Google\Chrome\Application\chrome.exe", _
                    "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe", _
                    "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
  cc = sh.ExpandEnvironmentStrings(c)
  If chrome = "" And fso.FileExists(cc) Then chrome = cc
Next
If chrome <> "" Then
  sh.Run """" & chrome & """ --app=" & url, 1, False
Else
  sh.Run url, 1, False
End If
