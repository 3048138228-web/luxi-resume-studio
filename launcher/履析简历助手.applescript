on run
  set projectPath to "__PROJECT_PATH__"
  set appURL to "http://127.0.0.1:4173/"
  set expectedTitle to "履析｜秋招岗位与定制简历"
  set shellPath to quoted form of projectPath
  set urlArg to quoted form of appURL
  set titleArg to quoted form of expectedTitle
  set readyCheck to "/usr/bin/curl -fsS --max-time 2 " & urlArg & " | /usr/bin/grep -Fq " & titleArg
  set portCheck to "/usr/sbin/lsof -nP -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1"
  set serviceAlreadyRunning to false

  try
    do shell script readyCheck
    set serviceAlreadyRunning to true
  end try

  set terminalCommand to "if ! cd " & shellPath & "; then " & ¬
    "echo '找不到履析项目目录，请确认文件夹没有被移动。'; exec /bin/zsh -l; fi; " & ¬
    "clear; echo '履析简历助手'; echo '────────────────────────'; " & ¬
    "if " & readyCheck & "; then " & ¬
    "echo '✓ 项目已经在运行'; echo '  " & appURL & "'; echo ''; echo '这个终端窗口可以保持开启。'; " & ¬
    "elif " & portCheck & "; then " & ¬
    "echo '✗ 4173 端口正被其他程序占用'; echo '请关闭占用该端口的程序后重新打开本 APP。'; " & ¬
    "else " & ¬
    "echo '正在启动本地服务…'; echo '服务运行期间请保持此窗口开启。'; echo ''; " & ¬
    "export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH; npm start; fi"

  tell application "Terminal"
    activate
    if serviceAlreadyRunning then
      do script "cd " & shellPath & "; clear; echo '履析简历助手'; echo '────────────────────────'; echo '✓ 项目已经在运行'; echo '  " & appURL & "'; echo ''; echo '这个终端窗口可以保持开启。'"
    else
      do script terminalCommand
    end if
  end tell

  if serviceAlreadyRunning then
    do shell script "/usr/bin/open " & urlArg
    return
  end if

  set isReady to false
  repeat 40 times
    try
      do shell script readyCheck
      set isReady to true
      exit repeat
    on error
      delay 0.25
    end try
  end repeat

  if isReady then
    do shell script "/usr/bin/open " & urlArg
  else
    display dialog "履析没有在 10 秒内启动成功。请查看刚刚打开的终端窗口，其中会显示具体原因。" buttons {"知道了"} default button 1 with icon caution
  end if
end run
