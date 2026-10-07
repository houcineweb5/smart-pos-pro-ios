using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace SmartPOS
{
    public class MainForm : Form
    {
        private Process serverProcess;
        private Label statusLabel;
        private Label ipLabel;
        private Button openAppBtn;
        private Button openMobileSyncBtn;
        private Button openFolderBtn;
        private Button exitBtn;
        private NotifyIcon trayIcon;
        private string baseDir;
        private string localIp;
        private int port = 3000;

        private bool allowVisible = false;
        private bool isExiting = false;
        private int hasAutoLaunched = 0;
        private int serverStartedFlag = 0;

        public MainForm()
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            localIp = GetLocalIPAddress();

            this.Text = "Smart Pos - مشغل النظام";
            this.Size = new Size(480, 340);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.ShowInTaskbar = false;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;
            this.Font = new Font("Tahoma", 9.5f, FontStyle.Regular);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            Label titleLabel = new Label();
            titleLabel.Text = "⚡ Smart Pos - نظام المبيعات والفوترة الذكي";
            titleLabel.Font = new Font("Tahoma", 13f, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(99, 102, 241);
            titleLabel.AutoSize = false;
            titleLabel.TextAlign = ContentAlignment.MiddleCenter;
            titleLabel.Bounds = new Rectangle(20, 15, 425, 32);
            this.Controls.Add(titleLabel);

            statusLabel = new Label();
            statusLabel.Text = "🟢 النظام يعمل في الخلفية بنجاح";
            statusLabel.Font = new Font("Tahoma", 10f, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(52, 211, 153);
            statusLabel.AutoSize = false;
            statusLabel.TextAlign = ContentAlignment.MiddleCenter;
            statusLabel.Bounds = new Rectangle(20, 52, 425, 28);
            this.Controls.Add(statusLabel);

            ipLabel = new Label();
            ipLabel.Text = "📱 رابط تطبيق الهاتف (Wi-Fi): http://" + localIp + ":" + port + "/mobile.html";
            ipLabel.Font = new Font("Tahoma", 9f, FontStyle.Regular);
            ipLabel.ForeColor = Color.FromArgb(148, 163, 184);
            ipLabel.AutoSize = false;
            ipLabel.TextAlign = ContentAlignment.MiddleCenter;
            ipLabel.Bounds = new Rectangle(20, 82, 425, 25);
            this.Controls.Add(ipLabel);

            openAppBtn = new Button();
            openAppBtn.Text = "🖥️ فتح شاشة البرنامج (نقطة البيع والإدارة)";
            openAppBtn.Font = new Font("Tahoma", 10.5f, FontStyle.Bold);
            openAppBtn.BackColor = Color.FromArgb(79, 70, 229);
            openAppBtn.ForeColor = Color.White;
            openAppBtn.FlatStyle = FlatStyle.Flat;
            openAppBtn.FlatAppearance.BorderSize = 0;
            openAppBtn.Bounds = new Rectangle(35, 120, 395, 44);
            openAppBtn.Cursor = Cursors.Hand;
            openAppBtn.Click += (s, e) => {
                Interlocked.Exchange(ref hasAutoLaunched, 1);
                OpenAppWindow("http://localhost:" + port);
            };
            this.Controls.Add(openAppBtn);

            openMobileSyncBtn = new Button();
            openMobileSyncBtn.Text = "📱 فتح نسخة الهاتف الذكي على الكمبيوتر";
            openMobileSyncBtn.Font = new Font("Tahoma", 9.5f, FontStyle.Bold);
            openMobileSyncBtn.BackColor = Color.FromArgb(16, 185, 129);
            openMobileSyncBtn.ForeColor = Color.White;
            openMobileSyncBtn.FlatStyle = FlatStyle.Flat;
            openMobileSyncBtn.FlatAppearance.BorderSize = 0;
            openMobileSyncBtn.Bounds = new Rectangle(35, 174, 192, 40);
            openMobileSyncBtn.Cursor = Cursors.Hand;
            openMobileSyncBtn.Click += (s, e) => OpenAppWindow("http://localhost:" + port + "/mobile.html");
            this.Controls.Add(openMobileSyncBtn);

            openFolderBtn = new Button();
            openFolderBtn.Text = "📂 مجلد قاعدة البيانات";
            openFolderBtn.Font = new Font("Tahoma", 9.5f, FontStyle.Bold);
            openFolderBtn.BackColor = Color.FromArgb(51, 65, 85);
            openFolderBtn.ForeColor = Color.White;
            openFolderBtn.FlatStyle = FlatStyle.Flat;
            openFolderBtn.FlatAppearance.BorderSize = 0;
            openFolderBtn.Bounds = new Rectangle(238, 174, 192, 40);
            openFolderBtn.Cursor = Cursors.Hand;
            openFolderBtn.Click += (s, e) => {
                try { Process.Start("explorer.exe", baseDir); } catch { }
            };
            this.Controls.Add(openFolderBtn);

            exitBtn = new Button();
            exitBtn.Text = "🔴 إيقاف الخادم وإغلاق البرنامج نهائياً";
            exitBtn.Font = new Font("Tahoma", 9.5f, FontStyle.Bold);
            exitBtn.BackColor = Color.FromArgb(220, 38, 38);
            exitBtn.ForeColor = Color.White;
            exitBtn.FlatStyle = FlatStyle.Flat;
            exitBtn.FlatAppearance.BorderSize = 0;
            exitBtn.Bounds = new Rectangle(35, 226, 395, 38);
            exitBtn.Cursor = Cursors.Hand;
            exitBtn.Click += (s, e) => CleanExit();
            this.Controls.Add(exitBtn);

            Label footerLabel = new Label();
            footerLabel.Text = "يعمل النظام تلقائياً في الخلفية بجانب الساعة دون الحاجة لإبقاء هذه النافذة مفتوحة";
            footerLabel.Font = new Font("Tahoma", 8f, FontStyle.Regular);
            footerLabel.ForeColor = Color.FromArgb(100, 116, 139);
            footerLabel.AutoSize = false;
            footerLabel.TextAlign = ContentAlignment.MiddleCenter;
            footerLabel.Bounds = new Rectangle(20, 272, 425, 20);
            this.Controls.Add(footerLabel);

            ContextMenu trayMenu = new ContextMenu();
            trayMenu.MenuItems.Add("🖥️ فتح شاشة البرنامج", (s, e) => {
                Interlocked.Exchange(ref hasAutoLaunched, 1);
                OpenAppWindow("http://localhost:" + port);
            });
            trayMenu.MenuItems.Add("⚙️ إظهار نافذة مشغل النظام", (s, e) => ShowLauncherForm());
            trayMenu.MenuItems.Add("📂 مجلد قاعدة البيانات", (s, e) => {
                try { Process.Start("explorer.exe", baseDir); } catch { }
            });
            trayMenu.MenuItems.Add("-");
            trayMenu.MenuItems.Add("🔴 إيقاف الخادم وإغلاق البرنامج", (s, e) => CleanExit());

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Smart Pos - يعمل في الخلفية";
            try { trayIcon.Icon = this.Icon ?? SystemIcons.Application; } catch { trayIcon.Icon = SystemIcons.Application; }
            trayIcon.ContextMenu = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => {
                Interlocked.Exchange(ref hasAutoLaunched, 1);
                OpenAppWindow("http://localhost:" + port);
            };

            this.FormClosing += MainForm_FormClosing;

            EnsureBackgroundServerStarted();
        }

        protected override void SetVisibleCore(bool value)
        {
            if (!allowVisible)
            {
                value = false;
                if (!this.IsHandleCreated)
                {
                    CreateHandle();
                }
            }
            base.SetVisibleCore(value);
        }

        private void ShowLauncherForm()
        {
            allowVisible = true;
            this.ShowInTaskbar = true;
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.Activate();
        }

        private void EnsureBackgroundServerStarted()
        {
            if (Interlocked.CompareExchange(ref serverStartedFlag, 1, 0) == 0)
            {
                Thread starterThread = new Thread(StartServerAndLaunch);
                starterThread.IsBackground = true;
                starterThread.Start();
            }
        }

        private void StartServerAndLaunch()
        {
            try
            {
                if (!IsPortListening(port))
                {
                    string nodePath = Path.Combine(baseDir, "runtime", "node.exe");
                    if (!File.Exists(nodePath))
                    {
                        nodePath = Path.Combine(baseDir, "node.exe");
                    }
                    if (!File.Exists(nodePath))
                    {
                        nodePath = @"C:\Program Files\nodejs\node.exe";
                    }
                    if (!File.Exists(nodePath))
                    {
                        nodePath = "node.exe";
                    }

                    string serverScript = Path.Combine(baseDir, "dist", "server.cjs");
                    if (!File.Exists(serverScript))
                    {
                        serverScript = Path.Combine(baseDir, "server.cjs");
                    }

                    if (!File.Exists(serverScript))
                    {
                        return;
                    }

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = nodePath;
                    psi.Arguments = "\"" + serverScript + "\"";
                    psi.WorkingDirectory = baseDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    psi.EnvironmentVariables["NODE_ENV"] = "production";
                    psi.EnvironmentVariables["PORT"] = port.ToString();

                    serverProcess = Process.Start(psi);
                }

                // Wait up to 6 seconds for TCP port 3000 to accept connections
                for (int i = 0; i < 40; i++)
                {
                    if (IsPortListening(port)) break;
                    Thread.Sleep(150);
                }

                // Open the application window strictly ONCE on initial startup
                if (Interlocked.CompareExchange(ref hasAutoLaunched, 1, 0) == 0)
                {
                    OpenAppWindow("http://localhost:" + port);
                }
            }
            catch
            {
            }
        }

        public static bool IsPortListening(int targetPort)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", targetPort, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        public static void OpenAppWindow(string url)
        {
            try
            {
                // Try opening as standalone desktop app window in Edge or Chrome
                string[] appBrowsers = new string[]
                {
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
                };

                foreach (string browser in appBrowsers)
                {
                    if (File.Exists(browser))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = browser;
                        psi.Arguments = "--app=" + url + " --start-maximized";
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                        return;
                    }
                }

                // Fallback to default browser
                Process.Start(url);
            }
            catch
            {
                try { Process.Start(url); } catch { }
            }
        }

        private string GetLocalIPAddress()
        {
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    {
                        string s = ip.ToString();
                        if (s.StartsWith("192.168.") || s.StartsWith("10.") || s.StartsWith("172."))
                            return s;
                    }
                }
            }
            catch { }
            return "localhost";
        }

        private void CleanExit()
        {
            isExiting = true;
            StopServer();
            if (trayIcon != null) trayIcon.Visible = false;
            Application.Exit();
        }

        private void StopServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(2000);
                }
            }
            catch { }
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (!isExiting && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                allowVisible = false;
                this.ShowInTaskbar = false;
                this.Hide();
                return;
            }
            StopServer();
            if (trayIcon != null) trayIcon.Visible = false;
        }

        [STAThread]
        public static void Main()
        {
            bool createdNew = false;
            using (Mutex mutex = new Mutex(true, @"Global\SmartPOS_SingleInstance_Mutex", out createdNew))
            {
                if (!createdNew)
                {
                    // Another instance is already running in the background -> just open the window once and exit!
                    OpenAppWindow("http://localhost:3000");
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
            }
        }
    }
}
