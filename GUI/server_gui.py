import tkinter as tk
from tkinter import messagebox
import subprocess
import threading
import os
import sys
import ctypes
import configparser
from tkinter import scrolledtext 


SETTING_Cache_FN = 'settings-cache.ini'

def get_executable_path():
    if getattr(sys, 'frozen', False):
        executable_path = sys.executable
    else:
        executable_path = os.path.abspath(__file__)
    return executable_path

class ExpressServerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("ShiguReader启动器")

        # 设置窗口图标
        icon_path = os.path.join(get_executable_path(), "..", 'favicon-96x96.png')
        self.root.iconbitmap(icon_path)
        if sys.platform == "win32":
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(u"mycompany.myproduct.subproduct.version")
            self.root.iconbitmap(icon_path)

        self.skip_scan = tk.BooleanVar()
        self.skip_db_clean = tk.BooleanVar()
        self.port = tk.StringVar(value="3000")

        self.load_settings()

        self.create_widgets()

        self.server_process = None
        self.log_thread = None

        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def create_widgets(self):
        frame = tk.Frame(self.root, padx=20, pady=10)
        frame.pack(fill='x')

        self.chk_skip_scan = tk.Checkbutton(frame, text="[快速启动] 跳过起始扫描 ", variable=self.skip_scan)
        self.chk_skip_scan.pack(anchor='w', pady=2)

        self.chk_skip_db_clean = tk.Checkbutton(frame, text="[高级功能] 不清理上次的DB缓存, 直接启动。", variable=self.skip_db_clean)
        self.chk_skip_db_clean.pack(anchor='w', pady=2)

        port_frame = tk.Frame(frame)
        port_frame.pack(anchor='w', pady=5)
        tk.Label(port_frame, text="HTTP端口:").pack(side='left')
        self.port_entry = tk.Entry(port_frame, textvariable=self.port, width=10)
        self.port_entry.pack(side='left', padx=5)

        warning_label = tk.Label(frame, text="初次使用记得修改config-path.ini 文件", fg="#cc3300")
        warning_label.pack(anchor='w', pady=2)

        self.btn_start = tk.Button(frame, text="Start Server", command=self.start_server)
        self.btn_start.pack(pady=10, anchor='w')

        self.log_text = scrolledtext.ScrolledText(self.root, state='disabled', height=15, width=80,  wrap=tk.WORD)
        self.log_text.pack(pady=10, padx=20, fill='x')

        url_frame = tk.Frame(self.root, padx=20, pady=5)
        url_frame.pack(fill='x')
        self.url_text = tk.Entry(url_frame, state='readonly', width=80)
        self.url_text.pack(fill='x')

        self.btn_stop = tk.Button(self.root, text="Stop Server", command=self.stop_server, state='disabled')
        self.btn_stop.pack(pady=10, anchor='w', padx=20)

    def start_server(self):
        options = []
        if self.skip_scan.get():
            options.append("--skip-scan")
        if self.skip_db_clean.get():
            options.append("--skip-db-clean")

        options.append("--port")
        options.append(self.port.get())
        options.append("--print-qr-code")
        options.append("false")

        pp = get_executable_path()
        script_dir = os.path.dirname(pp)
        exe_file = os.path.join(script_dir, "ShiguReader_Backend.exe")
        if os.path.exists(exe_file):
            cmd = [exe_file] + options
        else:
            server_script_path = os.path.join(script_dir, "..", "src", "server", "index.js")
            if not os.path.exists(server_script_path):
                messagebox.showwarning("Warning", "Server script not found at path: " + server_script_path)
                return
            cmd = ["node", server_script_path] + options

        self.server_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )

        self.log_thread = threading.Thread(target=self.read_log)
        self.log_thread.start()

        self.btn_start.config(state='disabled')
        self.btn_stop.config(state='normal')

        # 清空log
        self.log_text.config(state='normal')
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state='disabled')

        self.display_server_url(f"http://localhost:{self.port.get()}")

    def read_log(self):
        while self.server_process and self.server_process.poll() is None:
            line = self.server_process.stdout.readline()
            if line:
                self.append_log(line)
        if self.server_process:
            self.server_process.stdout.close()

    def append_log(self, text):
        self.log_text.config(state='normal')
        self.log_text.insert(tk.END, text)
        self.log_text.config(state='disabled')
        self.log_text.see(tk.END)

    def display_server_url(self, url):
        self.url_text.config(state='normal')
        self.url_text.delete(0, tk.END)
        self.url_text.insert(0, url)
        self.url_text.config(state='readonly')

    def stop_server(self):
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
            self.server_process = None

        self.btn_start.config(state='normal')
        self.btn_stop.config(state='disabled')
        self.append_log("\n\n\nServer has been stopped\n")
    
    def on_closing(self):
        self.stop_server()
        self.save_settings()
        self.root.destroy()

    def load_settings(self):
        config = configparser.ConfigParser()
        config.read(SETTING_Cache_FN)
        if 'Settings' in config:
            self.skip_scan.set(config.getboolean('Settings', 'skip_scan', fallback=True))
            self.skip_db_clean.set(config.getboolean('Settings', 'skip_db_clean', fallback=False))
            self.port.set(config.get('Settings', 'port', fallback="3000"))

    def save_settings(self):
        config = configparser.ConfigParser()
        config['Settings'] = {
            'skip_scan': self.skip_scan.get(),
            'skip_db_clean': self.skip_db_clean.get(),
            'port': self.port.get()
        }
        with open(SETTING_Cache_FN, 'w') as configfile:
            config.write(configfile)

if __name__ == "__main__":
    root = tk.Tk()
    app = ExpressServerGUI(root)
    root.mainloop()
