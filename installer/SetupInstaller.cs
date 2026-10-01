using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace SmartPOSSetup
{
    public class SetupForm : Form
    {
        private TextBox pathBox;
        private Button browseBtn;
        private Button installBtn;
        private ProgressBar progressBar;
        private Label statusLabel;
        private CheckBox desktopShortcutCheck;
        private CheckBox launchAfterCheck;

        public SetupForm()
        {
            this.Text = "Smart Pos Setup - معالج تثبيت البرنامج";
            this.Size = new Size(540, 380);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
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

            Label headerLabel = new Label();
            headerLabel.Text = "📦 تثبيت برنامج Smart Pos";
            headerLabel.Font = new Font("Tahoma", 14f, FontStyle.Bold);
            headerLabel.ForeColor = Color.FromArgb(99, 102, 241);
            headerLabel.AutoSize = false;
            headerLabel.TextAlign = ContentAlignment.MiddleCenter;
            headerLabel.Bounds = new Rectangle(20, 18, 485, 32);
            this.Controls.Add(headerLabel);

            Label subHeaderLabel = new Label();
            subHeaderLabel.Text = "نسخة مستقلة تماماً تعمل على أي جهاز كمبيوتر دون الحاجة لتنصيب أي برامج إضافية\nمع دعم تطبيق الهاتف الذكي والمزامنة السحابية والمحلية";
            subHeaderLabel.Font = new Font("Tahoma", 9f, FontStyle.Regular);
            subHeaderLabel.ForeColor = Color.FromArgb(148, 163, 184);
            subHeaderLabel.AutoSize = false;
            subHeaderLabel.TextAlign = ContentAlignment.MiddleCenter;
            subHeaderLabel.Bounds = new Rectangle(20, 54, 485, 42);
            this.Controls.Add(subHeaderLabel);

            Label pathLabel = new Label();
            pathLabel.Text = "مسار التثبيت على الجهاز:";
            pathLabel.Font = new Font("Tahoma", 9.5f, FontStyle.Bold);
            pathLabel.Bounds = new Rectangle(30, 110, 465, 22);
            this.Controls.Add(pathLabel);

            pathBox = new TextBox();
            pathBox.Text = @"C:\SmartPOS";
            pathBox.Font = new Font("Consolas", 10f, FontStyle.Regular);
            pathBox.RightToLeft = RightToLeft.No;
            pathBox.BackColor = Color.FromArgb(30, 41, 59);
            pathBox.ForeColor = Color.White;
            pathBox.BorderStyle = BorderStyle.FixedSingle;
            pathBox.Bounds = new Rectangle(30, 136, 360, 28);
            this.Controls.Add(pathBox);

            browseBtn = new Button();
            browseBtn.Text = "تغيير المسار...";
            browseBtn.BackColor = Color.FromArgb(51, 65, 85);
            browseBtn.ForeColor = Color.White;
            browseBtn.FlatStyle = FlatStyle.Flat;
            browseBtn.FlatAppearance.BorderSize = 0;
            browseBtn.Bounds = new Rectangle(400, 134, 95, 30);
            browseBtn.Click += BrowseBtn_Click;
            this.Controls.Add(browseBtn);

            desktopShortcutCheck = new CheckBox();
            desktopShortcutCheck.Text = "إنشاء اختصار Smart Pos على سطح المكتب (Desktop)";
            desktopShortcutCheck.Checked = true;
            desktopShortcutCheck.Bounds = new Rectangle(30, 176, 465, 24);
            this.Controls.Add(desktopShortcutCheck);

            launchAfterCheck = new CheckBox();
            launchAfterCheck.Text = "تشغيل برنامج Smart Pos فور انتهاء التثبيت";
            launchAfterCheck.Checked = true;
            launchAfterCheck.Bounds = new Rectangle(30, 204, 465, 24);
            this.Controls.Add(launchAfterCheck);

            progressBar = new ProgressBar();
            progressBar.Bounds = new Rectangle(30, 240, 465, 22);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "جاهز للتثبيت. اضغط على زر التثبيت بالأسفل للبدء.";
            statusLabel.ForeColor = Color.FromArgb(52, 211, 153);
            statusLabel.Bounds = new Rectangle(30, 268, 465, 22);
            this.Controls.Add(statusLabel);

            installBtn = new Button();
            installBtn.Text = "🚀 تثبيت البرنامج الآن";
            installBtn.Font = new Font("Tahoma", 11f, FontStyle.Bold);
            installBtn.BackColor = Color.FromArgb(79, 70, 229);
            installBtn.ForeColor = Color.White;
            installBtn.FlatStyle = FlatStyle.Flat;
            installBtn.FlatAppearance.BorderSize = 0;
            installBtn.Bounds = new Rectangle(30, 296, 465, 42);
            installBtn.Cursor = Cursors.Hand;
            installBtn.Click += InstallBtn_Click;
            this.Controls.Add(installBtn);
        }

        private void BrowseBtn_Click(object sender, EventArgs e)
        {
            using (FolderBrowserDialog fbd = new FolderBrowserDialog())
            {
                fbd.SelectedPath = pathBox.Text;
                if (fbd.ShowDialog() == DialogResult.OK)
                {
                    pathBox.Text = Path.Combine(fbd.SelectedPath, "SmartPOS");
                }
            }
        }

        private void InstallBtn_Click(object sender, EventArgs e)
        {
            string targetDir = pathBox.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("يرجى اختيار مسار التثبيت.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            installBtn.Enabled = false;
            browseBtn.Enabled = false;
            pathBox.Enabled = false;

            Thread worker = new Thread(() => RunInstallation(targetDir));
            worker.IsBackground = true;
            worker.Start();
        }

        private void RunInstallation(string targetDir)
        {
            try
            {
                UpdateProgress(10, "⏳ جاري تجهيز مجلد التثبيت...");
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                string tempZip = Path.Combine(Path.GetTempPath(), "smartpos_payload_" + Guid.NewGuid().ToString("N") + ".zip");
                UpdateProgress(25, "⏳ جاري استخراج حزمة النظام المدمجة...");

                using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
                {
                    if (resStream == null)
                    {
                        throw new Exception("لم يتم العثور على حزمة الملفات المدمجة (payload.zip).");
                    }
                    using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                    {
                        resStream.CopyTo(fs);
                    }
                }

                UpdateProgress(50, "⏳ جاري نسخ ملفات البرنامج وقاعدة البيانات والمشغل...");
                using (ZipArchive archive = ZipFile.OpenRead(tempZip))
                {
                    int total = archive.Entries.Count;
                    int current = 0;
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        current++;
                        string fullPath = Path.Combine(targetDir, entry.FullName);
                        string dirName = Path.GetDirectoryName(fullPath);
                        if (!string.IsNullOrEmpty(dirName) && !Directory.Exists(dirName))
                        {
                            Directory.CreateDirectory(dirName);
                        }

                        if (!string.IsNullOrEmpty(entry.Name))
                        {
                            entry.ExtractToFile(fullPath, true);
                        }

                        int pct = 50 + (int)((current / (double)Math.Max(1, total)) * 35);
                        UpdateProgress(pct, "⏳ جاري تثبيت الملفات (" + current + " / " + total + ")...");
                    }
                }

                try { File.Delete(tempZip); } catch { }

                string exePath = Path.Combine(targetDir, "SmartPOS.exe");

                if (desktopShortcutCheck.Checked)
                {
                    UpdateProgress(90, "⏳ جاري إنشاء اختصار Smart Pos على سطح المكتب وقائمة ابدأ...");
                    string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string oldDesktopShortcut = Path.Combine(desktopDir, "نظام المبيعات والفوترة الذكي.lnk");
                    if (File.Exists(oldDesktopShortcut))
                    {
                        try { File.Delete(oldDesktopShortcut); } catch { }
                    }
                    CreateShortcut(Path.Combine(desktopDir, "Smart Pos.lnk"), exePath, targetDir);

                    string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                    string oldStartShortcut = Path.Combine(startMenuDir, "نظام المبيعات والفوترة الذكي.lnk");
                    if (File.Exists(oldStartShortcut))
                    {
                        try { File.Delete(oldStartShortcut); } catch { }
                    }
                    CreateShortcut(Path.Combine(startMenuDir, "Smart Pos.lnk"), exePath, targetDir);
                }

                UpdateProgress(100, "✅ اكتمل التثبيت بنجاح!");

                this.Invoke((MethodInvoker)delegate
                {
                    MessageBox.Show("تم تثبيت برنامج Smart Pos بنجاح في:\n" + targetDir + "\n\nوتم إنشاء اختصار Smart Pos بأيقونة SP على سطح المكتب.", "اكتمل التثبيت بنجاح", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    if (launchAfterCheck.Checked && File.Exists(exePath))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = exePath;
                        psi.WorkingDirectory = targetDir;
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                    Application.Exit();
                });
            }
            catch (Exception ex)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    statusLabel.Text = "❌ خطأ أثناء التثبيت: " + ex.Message;
                    statusLabel.ForeColor = Color.FromArgb(248, 113, 113);
                    installBtn.Enabled = true;
                    browseBtn.Enabled = true;
                    pathBox.Enabled = true;
                    MessageBox.Show("حدث خطأ أثناء التثبيت:\n" + ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
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

        private void CreateShortcut(string shortcutPath, string targetExe, string workingDir)
        {
            try
            {
                if (File.Exists(shortcutPath))
                {
                    try { File.Delete(shortcutPath); } catch { }
                }
                string icoFile = Path.Combine(workingDir, "SmartPOS.ico");
                string iconLocation = File.Exists(icoFile) ? (icoFile + ",0") : (targetExe + ",0");

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
                shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDir });
                shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { iconLocation });
                shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Smart Pos" });
                shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
