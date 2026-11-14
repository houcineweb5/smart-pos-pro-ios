using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SmartPOSUninstall
{
    public class UninstallForm : Form
    {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

        private const int SHCNE_ASSOCCHANGED = 0x08000000;
        private const uint SHCNF_IDLIST = 0x0000;
        private const uint SHCNF_FLUSH = 0x1000;

        private Label titleLabel;
        private Label descLabel;
        private CheckBox keepDbCheck;
        private Button uninstallBtn;
        private Button cancelBtn;
        private ProgressBar progressBar;
        private Label statusLabel;
        private string installDir;

        public UninstallForm()
        {
            installDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');

            this.Text = "Smart Pos - معالج إزالة تثبيت البرنامج";
            this.Size = new Size(520, 340);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;

            try
            {
                this.Font = new Font("Cairo", 9.5f, FontStyle.Regular);
            }
            catch
            {
                this.Font = new Font("Tahoma", 9.5f, FontStyle.Regular);
            }

            try
            {
                string icoFile = Path.Combine(installDir, "SmartPOS.ico");
                if (File.Exists(icoFile))
                {
                    this.Icon = new Icon(icoFile);
                }
                else
                {
                    this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                }
            }
            catch { }

            titleLabel = new Label();
            titleLabel.Text = "🗑️ إزالة تثبيت برنامج Smart Pos";
            titleLabel.Font = new Font("Tahoma", 13f, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(244, 63, 94);
            titleLabel.AutoSize = false;
            titleLabel.TextAlign = ContentAlignment.MiddleCenter;
            titleLabel.Bounds = new Rectangle(20, 18, 465, 32);
            this.Controls.Add(titleLabel);

            descLabel = new Label();
            descLabel.Text = "هل أنت متأكد من رغبتك في إزالة برنامج Smart Pos من هذا الجهاز؟\nالمسار المستهدف: " + installDir;
            descLabel.Font = new Font("Tahoma", 9f, FontStyle.Regular);
            descLabel.ForeColor = Color.FromArgb(148, 163, 184);
            descLabel.AutoSize = false;
            descLabel.TextAlign = ContentAlignment.MiddleCenter;
            descLabel.Bounds = new Rectangle(20, 56, 465, 45);
            this.Controls.Add(descLabel);

            keepDbCheck = new CheckBox();
            keepDbCheck.Text = "الاحتفاظ بملف قاعدة البيانات (database.sqlite) لحماية فواتيرك ومبيعاتك (مستحسن)";
            keepDbCheck.Checked = true;
            keepDbCheck.Font = new Font("Tahoma", 9f, FontStyle.Bold);
            keepDbCheck.ForeColor = Color.FromArgb(52, 211, 153);
            keepDbCheck.Bounds = new Rectangle(30, 115, 455, 30);
            this.Controls.Add(keepDbCheck);

            progressBar = new ProgressBar();
            progressBar.Bounds = new Rectangle(30, 160, 445, 20);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "اضغط على زر إزالة التثبيت للمتابعة أو إلغاء للإغلاق.";
            statusLabel.ForeColor = Color.FromArgb(203, 213, 225);
            statusLabel.Font = new Font("Tahoma", 8.5f, FontStyle.Regular);
            statusLabel.Bounds = new Rectangle(30, 188, 445, 22);
            this.Controls.Add(statusLabel);

            uninstallBtn = new Button();
            uninstallBtn.Text = "🗑️ إزالة التثبيت الآن";
            uninstallBtn.Font = new Font("Tahoma", 10f, FontStyle.Bold);
            uninstallBtn.BackColor = Color.FromArgb(225, 29, 72);
            uninstallBtn.ForeColor = Color.White;
            uninstallBtn.FlatStyle = FlatStyle.Flat;
            uninstallBtn.FlatAppearance.BorderSize = 0;
            uninstallBtn.Bounds = new Rectangle(30, 225, 215, 42);
            uninstallBtn.Cursor = Cursors.Hand;
            uninstallBtn.Click += UninstallBtn_Click;
            this.Controls.Add(uninstallBtn);

            cancelBtn = new Button();
            cancelBtn.Text = "إلغاء الأمر";
            cancelBtn.Font = new Font("Tahoma", 10f, FontStyle.Bold);
            cancelBtn.BackColor = Color.FromArgb(51, 65, 85);
            cancelBtn.ForeColor = Color.White;
            cancelBtn.FlatStyle = FlatStyle.Flat;
            cancelBtn.FlatAppearance.BorderSize = 0;
            cancelBtn.Bounds = new Rectangle(260, 225, 215, 42);
            cancelBtn.Cursor = Cursors.Hand;
            cancelBtn.Click += (s, e) => this.Close();
            this.Controls.Add(cancelBtn);
        }

        private void UninstallBtn_Click(object sender, EventArgs e)
        {
            var res = MessageBox.Show(
                "هل أنت متأكد تماماً من رغبتك في إزالة برنامج Smart Pos نهائياً؟",
                "تأكيد إزالة التثبيت",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2
            );

            if (res != DialogResult.Yes) return;

            uninstallBtn.Enabled = false;
            cancelBtn.Enabled = false;
            keepDbCheck.Enabled = false;

            bool keepDb = keepDbCheck.Checked;
            Thread worker = new Thread(() => RunUninstall(keepDb));
            worker.IsBackground = true;
            worker.Start();
        }

        private void RunUninstall(bool keepDatabase)
        {
            try
            {
                UpdateProgress(15, "⏳ جاري إيقاف جميع عمليات وتشغيلات Smart Pos...");
                KillRunningProcesses();

                UpdateProgress(35, "⏳ جاري إزالة اختصارات سطح المكتب وقائمة ابدأ...");
                RemoveShortcuts();

                UpdateProgress(55, "⏳ جاري إزالة تسجيل البرنامج من إعدادات ويندوز...");
                RemoveRegistryEntries();

                UpdateProgress(75, "⏳ جاري حذف ملفات البرنامج...");
                DeleteAppFiles(keepDatabase);

                UpdateProgress(100, "✅ تمت إزالة تثبيت Smart Pos بنجاح!");

                this.Invoke((MethodInvoker)delegate
                {
                    try
                    {
                        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST | SHCNF_FLUSH, IntPtr.Zero, IntPtr.Zero);
                    }
                    catch { }

                    string msg = "تمت إزالة تثبيت برنامج Smart Pos بنجاح من جهازك.";
                    if (keepDatabase)
                    {
                        msg += "\n\n(تم الاحتفاظ بملف قاعدة البيانات database.sqlite لحماية بياناتك السابقة).";
                    }
                    MessageBox.Show(msg, "اكتملت الإزالة", MessageBoxButtons.OK, MessageBoxIcon.Information);

                    // Self delete executable via background delayed script
                    SelfDeleteAndExit();
                });
            }
            catch (Exception ex)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    statusLabel.Text = "❌ خطأ: " + ex.Message;
                    statusLabel.ForeColor = Color.FromArgb(248, 113, 113);
                    uninstallBtn.Enabled = true;
                    cancelBtn.Enabled = true;
                    MessageBox.Show("حدث خطأ أثناء الإزالة:\n" + ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
                });
            }
        }

        private void UpdateProgress(int val, string text)
        {
            this.Invoke((MethodInvoker)delegate
            {
                progressBar.Value = Math.Min(100, Math.Max(0, val));
                statusLabel.Text = text;
            });
        }

        private void KillRunningProcesses()
        {
            try
            {
                string[] procNames = new string[] { "SmartPOS", "SmartPOSLauncher", "node" };
                foreach (string name in procNames)
                {
                    foreach (var proc in Process.GetProcessesByName(name))
                    {
                        try
                        {
                            string path = "";
                            try { path = proc.MainModule.FileName; } catch { }
                            if (string.IsNullOrEmpty(path) || path.IndexOf(installDir, StringComparison.OrdinalIgnoreCase) >= 0 || name != "node")
                            {
                                proc.Kill();
                                proc.WaitForExit(1500);
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private void RemoveShortcuts()
        {
            string[] names = new string[]
            {
                "Smart Pos.lnk",
                "SmartPOS.lnk",
                "Smart POS.lnk",
                "Smart POS Pro.lnk",
                "إلغاء تثبيت Smart Pos.lnk",
                "Uninstall Smart Pos.lnk",
                "نظام المبيعات والفوترة الذكي.lnk",
                "نظام المبيعات والفوترة.lnk"
            };

            Environment.SpecialFolder[] folders = new Environment.SpecialFolder[]
            {
                Environment.SpecialFolder.DesktopDirectory,
                Environment.SpecialFolder.CommonDesktopDirectory,
                Environment.SpecialFolder.Programs,
                Environment.SpecialFolder.CommonPrograms
            };

            foreach (var folder in folders)
            {
                try
                {
                    string fPath = Environment.GetFolderPath(folder);
                    if (string.IsNullOrEmpty(fPath) || !Directory.Exists(fPath)) continue;

                    foreach (var n in names)
                    {
                        string p = Path.Combine(fPath, n);
                        if (File.Exists(p))
                        {
                            try { File.Delete(p); } catch { }
                        }
                    }
                }
                catch { }
            }
        }

        private void RemoveRegistryEntries()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                {
                    if (key != null)
                    {
                        try { key.DeleteSubKeyTree("SmartPOS", false); } catch { }
                    }
                }
            }
            catch { }

            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", true))
                {
                    if (key != null)
                    {
                        try { key.DeleteSubKeyTree("SmartPOS", false); } catch { }
                    }
                }
            }
            catch { }
        }

        private void DeleteAppFiles(bool keepDatabase)
        {
            try
            {
                string currentExe = Application.ExecutablePath;

                // Delete subdirectories (dist, public, runtime, assets, etc.)
                foreach (string dir in Directory.GetDirectories(installDir))
                {
                    try
                    {
                        Directory.Delete(dir, true);
                    }
                    catch { }
                }

                // Delete files except current uninstaller and possibly database
                foreach (string file in Directory.GetFiles(installDir))
                {
                    try
                    {
                        if (string.Equals(file, currentExe, StringComparison.OrdinalIgnoreCase)) continue;

                        string fileName = Path.GetFileName(file);
                        if (keepDatabase && (fileName.Equals("database.sqlite", StringComparison.OrdinalIgnoreCase) ||
                                            fileName.StartsWith("database.sqlite", StringComparison.OrdinalIgnoreCase)))
                        {
                            continue;
                        }

                        File.Delete(file);
                    }
                    catch { }
                }
            }
            catch { }
        }

        private void SelfDeleteAndExit()
        {
            try
            {
                string currentExe = Application.ExecutablePath;
                bool keepDb = keepDbCheck.Checked;

                // Create a batch script in temp to delete the uninstaller and the install folder if empty
                string tempBat = Path.Combine(Path.GetTempPath(), "cleanup_smartpos_" + Guid.NewGuid().ToString("N") + ".bat");
                using (StreamWriter sw = new StreamWriter(tempBat))
                {
                    sw.WriteLine("@echo off");
                    sw.WriteLine("timeout /t 2 /nobreak >nul");
                    sw.WriteLine("del /f /q \"" + currentExe + "\" >nul 2>&1");
                    if (!keepDb)
                    {
                        sw.WriteLine("rmdir /s /q \"" + installDir + "\" >nul 2>&1");
                    }
                    else
                    {
                        sw.WriteLine("rmdir \"" + installDir + "\" >nul 2>&1"); // Will only remove if empty
                    }
                    sw.WriteLine("del /f /q \"%~f0\" >nul 2>&1");
                }

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = tempBat;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            catch { }

            Application.Exit();
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UninstallForm());
        }
    }
}
