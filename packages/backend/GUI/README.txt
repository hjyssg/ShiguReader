套一层UI壳

build:
    python -m PyInstaller  --onefile --noconsole  --icon=favicon-96x96.png  --distpath .  --name SGR_Launch.exe    server_gui.py