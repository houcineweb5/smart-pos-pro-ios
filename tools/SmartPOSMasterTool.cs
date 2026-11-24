using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace SmartPOSMasterTool
{
    // ====================================================================
    // MODEL: Key History Item
    // ====================================================================
    public class KeyHistoryItem
    {
        public string Date { get; set; }
        public string Customer { get; set; }
        public string MachineId { get; set; }
        public string Key { get; set; }
        public string LicenseType { get; set; }
    }

    // ====================================================================
    // CUSTOM CONTROL: ModernCard (Anti-Aliased Smooth Card Container)
    // ====================================================================
    public class ModernCard : Panel
    {
        public Color BorderColor { get; set; }
        public int CornerRadius { get; set; }
        public bool IsHeaderButton { get; set; }

        public ModernCard()
        {
            this.SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw |
                ControlStyles.SupportsTransparentBackColor, true);
            this.DoubleBuffered = true;
            this.CornerRadius = 8;
            this.BorderColor = Color.FromArgb(226, 232, 240);
            this.BackColor = Color.White;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            try
            {
                if (this.Width <= 2 || this.Height <= 2) return;
                Graphics g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;

                Control p = this.Parent;
                Color parentBg = MainForm.WindowBg;
                while (p != null)
                {
                    if (p.BackColor != Color.Transparent && p.BackColor.A > 0)
                    {
                        parentBg = p.BackColor;
                        break;
                    }
                    p = p.Parent;
                }
                using (SolidBrush pb = new SolidBrush(parentBg))
                {
                    g.FillRectangle(pb, this.ClientRectangle);
                }

                Rectangle rect = new Rectangle(0, 0, this.Width - 1, this.Height - 1);
                if (rect.Width <= 2 || rect.Height <= 2) return;

                using (GraphicsPath path = MainForm.GetRoundedPath(rect, CornerRadius))
                {
                    using (SolidBrush bgBrush = new SolidBrush(this.BackColor))
                    {
                        g.FillPath(bgBrush, path);
                    }

                    if (BorderColor != Color.Transparent && BorderColor.A > 0)
                    {
                        using (Pen pen = new Pen(BorderColor, 1.2f))
                        {
                            g.DrawPath(pen, path);
                        }
                    }
                }
            }
            catch { }
        }
    }

    // ====================================================================
    // CUSTOM CONTROL: ModernButton (Silky Smooth, Zero Glitch, Hand Cursor)
    // ====================================================================
    public class ModernButton : Button
    {
        public Color ColorNormalTop { get; set; }
        public Color ColorNormalBottom { get; set; }
        public Color ColorHoverTop { get; set; }
        public Color ColorHoverBottom { get; set; }
        public Color ColorPressedTop { get; set; }
        public Color ColorPressedBottom { get; set; }
        public Color BorderColor { get; set; }
        public Color BorderHoverColor { get; set; }
        public int CornerRadius { get; set; }
        public bool IsHeaderButton { get; set; }

        private bool isHovered = false;
        private bool isPressed = false;

        public ModernButton()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw |
                ControlStyles.SupportsTransparentBackColor, true);

            SetStyle(ControlStyles.Selectable, false);
            this.DoubleBuffered = true;
            this.Cursor = Cursors.Default;
            this.CornerRadius = 7;
            this.Font = MainForm.GetAppFont(9f, FontStyle.Bold);
            this.ForeColor = Color.White;
            this.BackColor = Color.Transparent;
            this.FlatStyle = FlatStyle.Flat;
            this.FlatAppearance.BorderSize = 0;
            this.UseVisualStyleBackColor = false;

            // Default Indigo Theme
            ApplyTheme(
                Color.FromArgb(79, 70, 229), Color.FromArgb(67, 56, 202),
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(55, 48, 163), Color.FromArgb(49, 46, 129),
                Color.FromArgb(67, 56, 202), Color.FromArgb(79, 70, 229),
                Color.White
            );
        }

        public void ApplyTheme(Color cNormTop, Color cNormBtm, Color cHoverTop, Color cHoverBtm, Color cPressTop, Color cPressBtm, Color border, Color borderHover, Color textCol)
        {
            ColorNormalTop = cNormTop;
            ColorNormalBottom = cNormBtm;
            ColorHoverTop = cHoverTop;
            ColorHoverBottom = cHoverBtm;
            ColorPressedTop = cPressTop;
            ColorPressedBottom = cPressBtm;
            BorderColor = border;
            BorderHoverColor = borderHover;
            this.ForeColor = textCol;
            Invalidate();
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            base.OnMouseEnter(e);
            isHovered = true;
            Invalidate();
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            isHovered = false;
            isPressed = false;
            Invalidate();
        }

        protected override void OnMouseDown(MouseEventArgs mevent)
        {
            base.OnMouseDown(mevent);
            if (mevent.Button == MouseButtons.Left)
            {
                isPressed = true;
                Invalidate();
            }
        }

        protected override void OnMouseUp(MouseEventArgs mevent)
        {
            base.OnMouseUp(mevent);
            isPressed = false;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            try
            {
                if (this.Width <= 2 || this.Height <= 2) return;
                Graphics g = pevent.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                // 1. Fill exact parent background under corners
                if (IsHeaderButton || (this.Parent != null && (this.Parent.Name == "pnlHeader" || this.Parent == MainForm.HeaderPanelInstance)))
                {
                    int pw = this.Parent != null ? Math.Max(1, this.Parent.Width) : 820;
                    int ph = this.Parent != null ? this.Parent.Height : 64;
                    using (LinearGradientBrush lgb = new LinearGradientBrush(new Rectangle(0, 0, pw, ph), MainForm.HeaderGradStart, MainForm.HeaderGradEnd, LinearGradientMode.Horizontal))
                    {
                        lgb.TranslateTransform(-this.Left, -this.Top);
                        g.FillRectangle(lgb, this.ClientRectangle);
                    }
                }
                else
                {
                    Control p = this.Parent;
                    Color parentBg = MainForm.WindowBg;
                    while (p != null)
                    {
                        if (p.BackColor != Color.Transparent && p.BackColor.A > 0)
                        {
                            parentBg = p.BackColor;
                            break;
                        }
                        p = p.Parent;
                    }
                    using (SolidBrush pb = new SolidBrush(parentBg))
                    {
                        g.FillRectangle(pb, this.ClientRectangle);
                    }
                }

                Rectangle rect = new Rectangle(0, 0, this.Width - 1, this.Height - 1);
                if (rect.Width <= 2 || rect.Height <= 2) return;

                // 2. Select appropriate colors based on state
                Color cTop, cBottom, bColor;
                if (!this.Enabled)
                {
                    cTop = Color.FromArgb(241, 245, 249);
                    cBottom = Color.FromArgb(226, 232, 240);
                    bColor = Color.FromArgb(203, 213, 225);
                }
                else if (isPressed)
                {
                    cTop = ColorPressedTop;
                    cBottom = ColorPressedBottom;
                    bColor = BorderColor;
                }
                else if (isHovered)
                {
                    cTop = ColorHoverTop;
                    cBottom = ColorHoverBottom;
                    bColor = BorderHoverColor;
                }
                else
                {
                    cTop = ColorNormalTop;
                    cBottom = ColorNormalBottom;
                    bColor = BorderColor;
                }

                // 3. Draw rounded fill with vertical gradient
                using (GraphicsPath path = MainForm.GetRoundedPath(rect, CornerRadius))
                {
                    using (LinearGradientBrush lgb = new LinearGradientBrush(new Rectangle(0, 0, Math.Max(1, this.Width), Math.Max(1, this.Height)), cTop, cBottom, LinearGradientMode.Vertical))
                    {
                        g.FillPath(lgb, path);
                    }

                    // 4. Subtle top lighting highlight (only for raised buttons with visible border)
                    if (this.Enabled && !isPressed && rect.Height > 10 && bColor != Color.Transparent)
                    {
                        using (Pen hlPen = new Pen(Color.FromArgb(40, 255, 255, 255), 1f))
                        {
                            g.DrawLine(hlPen, rect.X + CornerRadius, rect.Y + 1, rect.Right - CornerRadius, rect.Y + 1);
                        }
                    }

                    // 5. Crisp smooth border
                    if (bColor != Color.Transparent && bColor.A > 0)
                    {
                        using (Pen pen = new Pen(bColor, 1.2f))
                        {
                            g.DrawPath(pen, path);
                        }
                    }
                }

                // 6. Draw Text with physical tactile 1px offset on press
                Rectangle textRect = isPressed ? new Rectangle(rect.X, rect.Y + 1, rect.Width, rect.Height) : rect;
                Color textCol = !this.Enabled ? Color.FromArgb(148, 163, 184) : this.ForeColor;

                TextFormatFlags flags = TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.WordEllipsis | TextFormatFlags.NoPrefix;
                if (this.RightToLeft == RightToLeft.Yes) flags |= TextFormatFlags.RightToLeft;

                TextRenderer.DrawText(g, this.Text, this.Font, textRect, textCol, flags);
            }
            catch { }
        }
    }

    // ====================================================================
    // MAIN APPLICATION FORM
    // ====================================================================
    public class MainForm : Form
    {
        public static Panel HeaderPanelInstance;
        private static PrivateFontCollection pfc = null;
        private static FontFamily appFontFamily = null;
        public static readonly string UnifiedFontName = "Cairo";

        public static void InitializeFonts()
        {
            try
            {
                foreach (FontFamily ff in FontFamily.Families)
                {
                    if (string.Equals(ff.Name, "Cairo", StringComparison.OrdinalIgnoreCase))
                    {
                        appFontFamily = ff;
                        return;
                    }
                }

                string baseDir = Application.StartupPath;
                string[] searchPaths = new string[]
                {
                    Path.Combine(baseDir, "public", "fonts", "Cairo-Variable.ttf"),
                    Path.Combine(baseDir, "dist", "fonts", "Cairo-Variable.ttf"),
                    Path.Combine(baseDir, "fonts", "Cairo-Variable.ttf"),
                    Path.Combine(baseDir, "Final-Release", "dist", "fonts", "Cairo-Variable.ttf"),
                    Path.Combine(baseDir, "Final-Release", "public", "fonts", "Cairo-Variable.ttf"),
                    Path.Combine(baseDir, "Cairo-Variable.ttf")
                };

                foreach (string fp in searchPaths)
                {
                    if (File.Exists(fp))
                    {
                        if (pfc == null) pfc = new PrivateFontCollection();
                        pfc.AddFontFile(fp);
                        if (pfc.Families.Length > 0)
                        {
                            appFontFamily = pfc.Families[pfc.Families.Length - 1];
                            return;
                        }
                    }
                }
            }
            catch { }
        }

        public static Font GetAppFont(float size, FontStyle style = FontStyle.Regular)
        {
            try
            {
                if (appFontFamily != null)
                {
                    return new Font(appFontFamily, size, style);
                }
                return new Font(UnifiedFontName, size, style);
            }
            catch
            {
                try
                {
                    return new Font("Segoe UI", size, style);
                }
                catch
                {
                    return new Font("Tahoma", size, style);
                }
            }
        }

        // Theme Colors
        public static readonly Color WindowBg      = Color.FromArgb(241, 245, 249); // Slate 100 (Soft Light Gray)
        public static readonly Color CardBg        = Color.FromArgb(255, 255, 255); // Pure White
        public static readonly Color CardBorder    = Color.FromArgb(226, 232, 240); // Slate 200
        public static readonly Color InputBg       = Color.FromArgb(255, 255, 255); // White
        public static readonly Color TextPrimary   = Color.FromArgb(15, 23, 42);    // Slate 900
        public static readonly Color TextSecondary = Color.FromArgb(51, 65, 85);    // Slate 700
        public static readonly Color TextMuted     = Color.FromArgb(100, 116, 139);  // Slate 500

        // Gradients & Sidebar Colors
        public static readonly Color HeaderGradStart = Color.FromArgb(15, 23, 42);   // Slate 900
        public static readonly Color HeaderGradEnd   = Color.FromArgb(49, 46, 129);  // Indigo 950
        public static readonly Color SidebarBg       = Color.FromArgb(15, 23, 42);   // Slate 900
        public static readonly Color SidebarBorder   = Color.FromArgb(30, 41, 59);   // Slate 800
        public static readonly Color SidebarCard     = Color.FromArgb(11, 17, 32);   // Slate 950
        public static readonly Color DarkFooterBg    = Color.FromArgb(15, 23, 42);   // Slate 900

        private const string LicenseSalt = "SMARTPOS_PRO_ENTERPRISE_SECRET_SALT_2026#98765";

        // Language state: true = Arabic (default), false = French
        private bool isArabic = true;

        // Sidebar controls
        private Panel pnlSidebar;
        private Panel pnlSidebarHeader;
        private Label lblSidebarTitle;
        private Label lblSidebarSubtitle;
        private Label lblNavCategory;
        private Panel pnlSidebarFooter;
        private Label lblSupportTitleSidebar;
        private Label lblSupportContactSidebar;
        private Label lblSupportDescSidebar;

        // Navigation Tabs (5 Tabs in Sidebar)
        private ModernButton btnTabLicense;
        private ModernButton btnTabKeysHistory;
        private ModernButton btnTabDatabase;
        private ModernButton btnTabBuild;
        private ModernButton btnTabLogs;

        // Main Container & Header
        private Panel pnlMainContainer;
        private Panel pnlContentHeader;
        private Label lblHeaderTitle;
        private Label lblHeaderSubtitle;
        private Label lblStatusServer;
        private Label lblStatusDb;
        private ModernButton btnLangToggle;

        // Content Panels
        private Panel panelLicense;
        private Panel panelKeysHistory;
        private Panel panelDatabase;
        private Panel panelBuild;
        private Panel panelLogs;
        private Panel pnlContent;
        private int currentTabIndex = 0;

        // License Tab Controls
        private ModernCard cardMachineId;
        private ModernCard cardGenerate;
        private ModernCard cardSupportFooter;
        private Label lblMidHeader;
        private Label lblMidHint;
        private Label lblCustHeader;
        private Label lblSupportTitle;
        private Label lblSupportContact;
        private Label lblSupportDesc;
        private TextBox txtMachineId;
        private TextBox txtCustomerName;
        private TextBox txtGeneratedKey;
        private TextBox txtCustomerMessage;
        private ModernButton btnGenKey;
        private ModernButton btnCopyKey;
        private ModernButton btnActivateThisPc;
        private ModernButton btnCopyMsg;
        private ModernButton btnPasteMachineId;
        private ModernButton btnUseThisPcId;
        private ModernButton btnVerifyKey;

        // Keys History Tab Controls
        private ModernCard cardHistoryHeader;
        private ModernCard cardHistoryTable;
        private DataGridView dgvKeys;
        private TextBox txtSearchHistory;
        private Label lblHistoryCount;
        private Label lblTableTip;
        private ModernButton btnCopyHistoryKey;
        private ModernButton btnActivateSelectedHistory;
        private ModernButton btnDeleteHistory;
        private ModernButton btnRefreshHistory;
        private List<KeyHistoryItem> allHistoryItems = new List<KeyHistoryItem>();

        // Database Tab Controls
        private ModernCard cardDbClean;
        private ModernCard cardDbReset;
        private ModernCard cardDbFolders;
        private Label lblDbC1Title;
        private Label lblDbC1Desc;
        private Label lblDbC2Title;
        private Label lblDbC2Desc;
        private Label lblDbC3Title;
        private ModernButton btnCreateCleanDb;
        private ModernButton btnCleanMainDb;
        private ModernButton btnOpenDbFolder;
        private ModernButton btnOpenBackupFolder;

        // Build Tab Controls
        private ModernCard cardBuildMain;
        private Label lblBTitle;
        private Label lblBDesc;
        private ModernButton btnStartBuild;
        private ModernButton btnOpenReleaseFolder;
        private CheckBox chkCleanDbBeforeBuild;
        private CheckBox chkOpenFolderOnComplete;

        // Activity Log Controls
        private ModernCard cardLogs;
        private Label lblLogTitle;
        private TextBox txtLog;
        private ProgressBar progressBar;
        private Label lblCurrentStatus;
        private ModernButton btnClearLog;
        private ModernButton btnCopyLog;

        // Process running flag
        private bool isRunningTask = false;
        private Process currentProcess = null;

        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            InitializeFonts();
            Application.Run(new MainForm());
        }

        public MainForm()
        {
            InitializeComponent();
            ApplyLanguage(isArabic);
            RefreshStatusBadges();
            LoadKeysHistoryFromFile();
            AppendLog(isArabic 
                ? "SmartPOS Pro — تم تشغيل لوحة أدوات المطور والإدارة بنجاح." 
                : "SmartPOS Pro — Master Tool initialisé avec succès.");
            AppendLog("Répertoire / المسار : " + Application.StartupPath);
        }

        private void InitializeComponent()
        {
            // Modern spacious window dimensions: 1020x680 matching SMARTPOS console layout
            this.Text = "SmartPOS Pro — أداة المطور والإدارة الرئيسية";
            this.ClientSize = new Size(1020, 680);
            this.MinimumSize = new Size(1020, 680);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.BackColor = WindowBg;
            this.ForeColor = TextPrimary;
            this.DoubleBuffered = true;

            this.Font = GetAppFont(9.25f, FontStyle.Regular);

            // Load Application Icon if available
            try
            {
                string iconPath = Path.Combine(Application.StartupPath, "installer", "SmartPOS.ico");
                if (!File.Exists(iconPath)) iconPath = Path.Combine(Application.StartupPath, "SmartPOS.ico");
                if (File.Exists(iconPath)) this.Icon = new Icon(iconPath);
            }
            catch { }

            // =================================================================
            // 1. SMARTPOS DARK SIDEBAR (لوحة جانبية احترافية)
            // =================================================================
            pnlSidebar = new Panel();
            pnlSidebar.Name = "pnlSidebar";
            pnlSidebar.Width = 236;
            pnlSidebar.Dock = isArabic ? DockStyle.Right : DockStyle.Left;
            pnlSidebar.BackColor = SidebarBg;
            pnlSidebar.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    using (Pen p = new Pen(SidebarBorder, 1))
                    {
                        if (pnlSidebar.Dock == DockStyle.Right)
                        {
                            e.Graphics.DrawLine(p, 0, 0, 0, pnlSidebar.Height);
                        }
                        else
                        {
                            e.Graphics.DrawLine(p, pnlSidebar.Width - 1, 0, pnlSidebar.Width - 1, pnlSidebar.Height);
                        }
                    }
                }
                catch { }
            };
            this.Controls.Add(pnlSidebar);

            // Sidebar Header (Logo Badge & App Title)
            pnlSidebarHeader = new Panel();
            pnlSidebarHeader.Dock = DockStyle.Top;
            pnlSidebarHeader.Height = 74;
            pnlSidebarHeader.BackColor = SidebarBg;
            pnlSidebarHeader.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    using (Pen p = new Pen(SidebarBorder, 1))
                    {
                        e.Graphics.DrawLine(p, 0, pnlSidebarHeader.Height - 1, pnlSidebarHeader.Width, pnlSidebarHeader.Height - 1);
                    }
                }
                catch { }
            };
            pnlSidebar.Controls.Add(pnlSidebarHeader);

            // Vector Key Logo Badge
            Panel pnlLogoBadge = new Panel();
            pnlLogoBadge.Size = new Size(38, 38);
            pnlLogoBadge.Location = new Point(12, 18);
            pnlLogoBadge.BackColor = Color.Transparent;
            pnlLogoBadge.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    if (pnlLogoBadge.Width <= 0 || pnlLogoBadge.Height <= 0) return;
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    using (GraphicsPath path = GetRoundedPath(new Rectangle(0, 0, 37, 37), 8))
                    {
                        using (SolidBrush b = new SolidBrush(Color.FromArgb(30, 41, 59)))
                        {
                            e.Graphics.FillPath(b, path);
                        }
                        using (Pen p = new Pen(Color.FromArgb(79, 70, 229), 1.2f))
                        {
                            e.Graphics.DrawPath(p, path);
                        }
                    }
                    using (Pen keyPen = new Pen(Color.FromArgb(251, 191, 36), 2f))
                    {
                        keyPen.StartCap = LineCap.Round;
                        keyPen.EndCap = LineCap.Round;
                        e.Graphics.DrawEllipse(keyPen, 10, 10, 9, 9);
                        e.Graphics.DrawLine(keyPen, 18, 18, 27, 27);
                        e.Graphics.DrawLine(keyPen, 23, 23, 27, 19);
                    }
                }
                catch { }
            };
            pnlSidebarHeader.Controls.Add(pnlLogoBadge);

            lblSidebarTitle = new Label();
            lblSidebarTitle.Text = "SmartPOS Pro";
            lblSidebarTitle.Font = GetAppFont(11.5f, FontStyle.Bold);
            lblSidebarTitle.ForeColor = Color.White;
            lblSidebarTitle.BackColor = Color.Transparent;
            lblSidebarTitle.UseMnemonic = false;
            lblSidebarTitle.AutoSize = true;
            lblSidebarTitle.Location = new Point(58, 15);
            pnlSidebarHeader.Controls.Add(lblSidebarTitle);

            lblSidebarSubtitle = new Label();
            lblSidebarSubtitle.Text = "لوحة أدوات المطور والإدارة";
            lblSidebarSubtitle.Font = GetAppFont(7.5f, FontStyle.Regular);
            lblSidebarSubtitle.ForeColor = Color.FromArgb(148, 163, 184);
            lblSidebarSubtitle.BackColor = Color.Transparent;
            lblSidebarSubtitle.UseMnemonic = false;
            lblSidebarSubtitle.AutoSize = true;
            lblSidebarSubtitle.Location = new Point(59, 39);
            pnlSidebarHeader.Controls.Add(lblSidebarSubtitle);

            // Navigation Section Category
            lblNavCategory = new Label();
            lblNavCategory.Text = "الأقسام الرئيسية";
            lblNavCategory.Font = GetAppFont(7.5f, FontStyle.Bold);
            lblNavCategory.ForeColor = Color.FromArgb(100, 116, 139);
            lblNavCategory.BackColor = Color.Transparent;
            lblNavCategory.UseMnemonic = false;
            lblNavCategory.Location = new Point(14, 86);
            lblNavCategory.AutoSize = true;
            pnlSidebar.Controls.Add(lblNavCategory);

            // Navigation Tabs (5 Vertical Buttons in Sidebar)
            int tabW = 212;
            btnTabLicense     = CreateNavTabButton("التراخيص والتفعيل", 112, tabW);
            btnTabKeysHistory = CreateNavTabButton("سجل المفاتيح", 158, tabW);
            btnTabDatabase    = CreateNavTabButton("قاعدة البيانات", 204, tabW);
            btnTabBuild       = CreateNavTabButton("بناء الحزمة", 250, tabW);
            btnTabLogs        = CreateNavTabButton("سجل العمليات", 296, tabW);

            btnTabLicense.Click     += delegate { SwitchTab(0); };
            btnTabKeysHistory.Click += delegate { SwitchTab(1); };
            btnTabDatabase.Click    += delegate { SwitchTab(2); };
            btnTabBuild.Click       += delegate { SwitchTab(3); };
            btnTabLogs.Click        += delegate { SwitchTab(4); };

            pnlSidebar.Controls.Add(btnTabLicense);
            pnlSidebar.Controls.Add(btnTabKeysHistory);
            pnlSidebar.Controls.Add(btnTabDatabase);
            pnlSidebar.Controls.Add(btnTabBuild);
            pnlSidebar.Controls.Add(btnTabLogs);

            // Sidebar Footer Container (Status badges, Lang button & Direct Support)
            pnlSidebarFooter = new Panel();
            pnlSidebarFooter.Dock = DockStyle.Bottom;
            pnlSidebarFooter.Height = 226;
            pnlSidebarFooter.BackColor = SidebarBg;
            pnlSidebarFooter.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    using (Pen p = new Pen(SidebarBorder, 1))
                    {
                        e.Graphics.DrawLine(p, 0, 0, pnlSidebarFooter.Width, 0);
                    }
                }
                catch { }
            };
            pnlSidebar.Controls.Add(pnlSidebarFooter);

            lblStatusServer = new Label();
            lblStatusServer.Size = new Size(212, 28);
            lblStatusServer.Location = new Point(12, 10);
            lblStatusServer.BackColor = Color.FromArgb(25, 255, 255, 255);
            lblStatusServer.ForeColor = Color.White;
            lblStatusServer.Font = GetAppFont(7.5f, FontStyle.Bold);
            lblStatusServer.TextAlign = ContentAlignment.MiddleCenter;
            lblStatusServer.Text = "السيرفر: ...";
            pnlSidebarFooter.Controls.Add(lblStatusServer);

            lblStatusDb = new Label();
            lblStatusDb.Size = new Size(212, 28);
            lblStatusDb.Location = new Point(12, 44);
            lblStatusDb.BackColor = Color.FromArgb(25, 255, 255, 255);
            lblStatusDb.ForeColor = Color.White;
            lblStatusDb.Font = GetAppFont(7.5f, FontStyle.Bold);
            lblStatusDb.TextAlign = ContentAlignment.MiddleCenter;
            lblStatusDb.Text = "القاعدة: ...";
            pnlSidebarFooter.Controls.Add(lblStatusDb);

            btnLangToggle = new ModernButton();
            btnLangToggle.Text = "🌐  Français";
            btnLangToggle.Size = new Size(212, 34);
            btnLangToggle.Location = new Point(12, 78);
            btnLangToggle.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnLangToggle.ApplyTheme(
                Color.FromArgb(245, 158, 11), Color.FromArgb(217, 119, 6),
                Color.FromArgb(251, 191, 36), Color.FromArgb(245, 158, 11),
                Color.FromArgb(180, 83, 9), Color.FromArgb(146, 64, 14),
                Color.FromArgb(217, 119, 6), Color.FromArgb(245, 158, 11),
                Color.White
            );
            btnLangToggle.Click += delegate
            {
                ApplyLanguage(!isArabic);
            };
            pnlSidebarFooter.Controls.Add(btnLangToggle);

            // Quick Support Box in Sidebar
            ModernCard cardSupportSidebar = new ModernCard();
            cardSupportSidebar.Location = new Point(12, 120);
            cardSupportSidebar.Size = new Size(212, 96);
            cardSupportSidebar.BackColor = SidebarCard;
            cardSupportSidebar.BorderColor = SidebarBorder;
            pnlSidebarFooter.Controls.Add(cardSupportSidebar);

            lblSupportTitleSidebar = new Label();
            lblSupportTitleSidebar.Text = "الدعم الفني والمبيعات :";
            lblSupportTitleSidebar.Font = GetAppFont(7.5f, FontStyle.Bold);
            lblSupportTitleSidebar.ForeColor = Color.FromArgb(251, 191, 36);
            lblSupportTitleSidebar.BackColor = Color.Transparent;
            lblSupportTitleSidebar.Location = new Point(10, 8);
            lblSupportTitleSidebar.AutoSize = true;
            cardSupportSidebar.Controls.Add(lblSupportTitleSidebar);

            lblSupportContactSidebar = new Label();
            lblSupportContactSidebar.Text = "0677212982";
            lblSupportContactSidebar.Font = GetAppFont(10.5f, FontStyle.Bold);
            lblSupportContactSidebar.ForeColor = Color.FromArgb(52, 211, 153);
            lblSupportContactSidebar.BackColor = Color.Transparent;
            lblSupportContactSidebar.Location = new Point(10, 32);
            lblSupportContactSidebar.AutoSize = true;
            cardSupportSidebar.Controls.Add(lblSupportContactSidebar);

            lblSupportDescSidebar = new Label();
            lblSupportDescSidebar.Text = "مساعدة فورية وتفعيل دائم";
            lblSupportDescSidebar.Font = GetAppFont(7.25f, FontStyle.Regular);
            lblSupportDescSidebar.ForeColor = Color.FromArgb(148, 163, 184);
            lblSupportDescSidebar.BackColor = Color.Transparent;
            lblSupportDescSidebar.Location = new Point(10, 62);
            lblSupportDescSidebar.AutoSize = true;
            cardSupportSidebar.Controls.Add(lblSupportDescSidebar);

            // =================================================================
            // 2. MAIN CONTAINER (المساحة الرئيسية)
            // =================================================================
            pnlMainContainer = new Panel();
            pnlMainContainer.Dock = DockStyle.Fill;
            pnlMainContainer.BackColor = WindowBg;
            this.Controls.Add(pnlMainContainer);

            // Content Header Bar
            pnlContentHeader = new Panel();
            pnlContentHeader.Dock = DockStyle.Top;
            pnlContentHeader.Height = 64;
            pnlContentHeader.BackColor = CardBg;
            pnlContentHeader.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    if (pnlContentHeader.Width <= 0 || pnlContentHeader.Height <= 0) return;
                    using (Pen p = new Pen(CardBorder, 1))
                    {
                        e.Graphics.DrawLine(p, 0, pnlContentHeader.Height - 1, pnlContentHeader.Width, pnlContentHeader.Height - 1);
                    }
                }
                catch { }
            };
            pnlMainContainer.Controls.Add(pnlContentHeader);

            lblHeaderTitle = new Label();
            lblHeaderTitle.Text = "التراخيص وتفعيل الأجهزة";
            lblHeaderTitle.Font = GetAppFont(12f, FontStyle.Bold);
            lblHeaderTitle.ForeColor = TextPrimary;
            lblHeaderTitle.BackColor = Color.Transparent;
            lblHeaderTitle.UseMnemonic = false;
            lblHeaderTitle.AutoSize = true;
            lblHeaderTitle.Location = new Point(18, 10);
            pnlContentHeader.Controls.Add(lblHeaderTitle);

            lblHeaderSubtitle = new Label();
            lblHeaderSubtitle.Text = "توليد مفاتيح التفعيل الدائمة • ربط عتادي آمن (HMAC-SHA256) لحماية البرنامج";
            lblHeaderSubtitle.Font = GetAppFont(8.5f, FontStyle.Regular);
            lblHeaderSubtitle.ForeColor = TextMuted;
            lblHeaderSubtitle.BackColor = Color.Transparent;
            lblHeaderSubtitle.UseMnemonic = false;
            lblHeaderSubtitle.AutoSize = true;
            lblHeaderSubtitle.Location = new Point(18, 36);
            pnlContentHeader.Controls.Add(lblHeaderSubtitle);

            // Bottom Mini Status Bar
            Panel pnlBottomBar = new Panel();
            pnlBottomBar.Dock = DockStyle.Bottom;
            pnlBottomBar.Height = 30;
            pnlBottomBar.BackColor = CardBg;
            pnlBottomBar.Padding = new Padding(14, 4, 14, 4);
            pnlBottomBar.Paint += delegate(object s, PaintEventArgs e)
            {
                try
                {
                    if (pnlBottomBar.Width <= 0 || pnlBottomBar.Height <= 0) return;
                    using (Pen pen = new Pen(CardBorder, 1))
                    {
                        e.Graphics.DrawLine(pen, 0, 0, pnlBottomBar.Width, 0);
                    }
                }
                catch { }
            };
            pnlMainContainer.Controls.Add(pnlBottomBar);

            lblCurrentStatus = new Label();
            lblCurrentStatus.Text = "الحالة : جاهز • هاتف الدعم الفني المباشر : 0677212982";
            lblCurrentStatus.ForeColor = TextSecondary;
            lblCurrentStatus.Font = GetAppFont(8.25f, FontStyle.Regular);
            lblCurrentStatus.UseMnemonic = false;
            lblCurrentStatus.AutoSize = true;
            lblCurrentStatus.Location = new Point(14, 7);
            pnlBottomBar.Controls.Add(lblCurrentStatus);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Size = new Size(180, 16);
            progressBar.Dock = DockStyle.Right;
            progressBar.Visible = false;
            pnlBottomBar.Controls.Add(progressBar);

            // Main Central Content Host
            pnlContent = new Panel();
            pnlContent.Dock = DockStyle.Fill;
            pnlContent.BackColor = WindowBg;
            pnlContent.AutoScroll = false;
            pnlMainContainer.Controls.Add(pnlContent);

            pnlContentHeader.SendToBack();
            pnlBottomBar.SendToBack();
            pnlContent.BringToFront();

            // WinForms docking rule: Edge-docked controls (pnlSidebar) must be SendToBack (highest index)
            // and Fill controls (pnlMainContainer) must be BringToFront (index 0) so the Fill control computes remaining space.
            pnlSidebar.SendToBack();
            pnlMainContainer.BringToFront();

            // Build individual tab panels
            BuildLicensePanel();
            BuildKeysHistoryPanel();
            BuildDatabasePanel();
            BuildBuildPanel();
            BuildLogsPanel();

            SwitchTab(0);
        }

        // ====================================================================
        // TAB 1: GESTION DES LICENCES & ACTIVATION
        // ====================================================================
        private void BuildLicensePanel()
        {
            panelLicense = new Panel();
            panelLicense.Location = new Point(12, 10);
            panelLicense.Size = new Size(760, 566);
            panelLicense.BackColor = WindowBg;
            pnlContent.Controls.Add(panelLicense);

            // 1. Machine ID Card (With comfortable 14px-16px gap between controls)
            cardMachineId = new ModernCard();
            cardMachineId.Location = new Point(0, 0);
            cardMachineId.Size = new Size(760, 96);
            cardMachineId.BackColor = CardBg;
            cardMachineId.BorderColor = CardBorder;
            panelLicense.Controls.Add(cardMachineId);

            lblMidHeader = new Label();
            lblMidHeader.Text = "معرف الجهاز الخاص بالزبون (Machine ID) :";
            lblMidHeader.Font = GetAppFont(9f, FontStyle.Bold);
            lblMidHeader.ForeColor = TextPrimary;
            lblMidHeader.Location = new Point(16, 10);
            lblMidHeader.AutoSize = true;
            cardMachineId.Controls.Add(lblMidHeader);

            txtMachineId = new TextBox();
            txtMachineId.Font = GetAppFont(11.5f, FontStyle.Bold);
            txtMachineId.ForeColor = Color.FromArgb(30, 41, 59);
            txtMachineId.BackColor = Color.FromArgb(248, 250, 252);
            txtMachineId.TextAlign = HorizontalAlignment.Center;
            txtMachineId.BorderStyle = BorderStyle.FixedSingle;
            txtMachineId.Location = new Point(16, 33);
            txtMachineId.Size = new Size(428, 28);
            txtMachineId.Text = GetLocalMachineIdNative();
            cardMachineId.Controls.Add(txtMachineId);

            btnPasteMachineId = new ModernButton();
            btnPasteMachineId.Text = "📋 لصق المعرف";
            btnPasteMachineId.Size = new Size(136, 30);
            btnPasteMachineId.Location = new Point(458, 31);
            btnPasteMachineId.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnPasteMachineId.ApplyTheme(
                Color.FromArgb(79, 70, 229), Color.FromArgb(67, 56, 202),
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(55, 48, 163), Color.FromArgb(49, 46, 129),
                Color.FromArgb(67, 56, 202), Color.FromArgb(79, 70, 229),
                Color.White
            );
            btnPasteMachineId.Click += delegate
            {
                try
                {
                    string clip = Clipboard.GetText();
                    if (!string.IsNullOrEmpty(clip))
                    {
                        txtMachineId.Text = clip.Trim().ToUpperInvariant();
                        AppendLog(isArabic ? "تم لصق معرف الجهاز : " + txtMachineId.Text : "Machine ID collé : " + txtMachineId.Text);
                    }
                }
                catch { }
            };
            cardMachineId.Controls.Add(btnPasteMachineId);

            btnUseThisPcId = new ModernButton();
            btnUseThisPcId.Text = "💻 هذا الحاسوب";
            btnUseThisPcId.Size = new Size(136, 30);
            btnUseThisPcId.Location = new Point(606, 31);
            btnUseThisPcId.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnUseThisPcId.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnUseThisPcId.Click += delegate
            {
                txtMachineId.Text = GetLocalMachineIdNative();
                AppendLog(isArabic ? "تم جلب معرف هذا الحاسوب : " + txtMachineId.Text : "ID de ce PC récupéré : " + txtMachineId.Text);
            };
            cardMachineId.Controls.Add(btnUseThisPcId);

            lblMidHint = new Label();
            lblMidHint.Text = "✦ المعرف العتادي للجهاز (انسخ المعرف الظاهر في شاشة الزبون وألصقه هنا لتوليد ترخيصه الدائم).";
            lblMidHint.Font = GetAppFont(8f, FontStyle.Regular);
            lblMidHint.ForeColor = TextMuted;
            lblMidHint.Location = new Point(16, 68);
            lblMidHint.AutoSize = true;
            cardMachineId.Controls.Add(lblMidHint);

            // 2. Generate License Card
            cardGenerate = new ModernCard();
            cardGenerate.Location = new Point(0, 106);
            cardGenerate.Size = new Size(760, 318);
            cardGenerate.BackColor = CardBg;
            cardGenerate.BorderColor = CardBorder;
            panelLicense.Controls.Add(cardGenerate);

            lblCustHeader = new Label();
            lblCustHeader.Text = "اسم الزبون أو المحل التجاري (اختياري) :";
            lblCustHeader.Font = GetAppFont(8.5f, FontStyle.Bold);
            lblCustHeader.ForeColor = TextSecondary;
            lblCustHeader.Location = new Point(16, 10);
            lblCustHeader.AutoSize = true;
            cardGenerate.Controls.Add(lblCustHeader);

            txtCustomerName = new TextBox();
            txtCustomerName.Font = GetAppFont(9.5f, FontStyle.Regular);
            txtCustomerName.ForeColor = TextPrimary;
            txtCustomerName.BackColor = InputBg;
            txtCustomerName.BorderStyle = BorderStyle.FixedSingle;
            txtCustomerName.Text = "المحل التجاري";
            txtCustomerName.Location = new Point(16, 34);
            txtCustomerName.Size = new Size(728, 26);
            cardGenerate.Controls.Add(txtCustomerName);

            // Prominent Generate Button
            btnGenKey = new ModernButton();
            btnGenKey.Text = "⚡ توليد مفتاح التفعيل الرسمي الدائم (Generate License Key)";
            btnGenKey.Font = GetAppFont(10.5f, FontStyle.Bold);
            btnGenKey.Location = new Point(16, 70);
            btnGenKey.Size = new Size(728, 38);
            btnGenKey.ApplyTheme(
                Color.FromArgb(79, 70, 229), Color.FromArgb(67, 56, 202),
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(55, 48, 163), Color.FromArgb(49, 46, 129),
                Color.FromArgb(67, 56, 202), Color.FromArgb(79, 70, 229),
                Color.White
            );
            btnGenKey.Click += delegate { DoGenerateLicense(); };
            cardGenerate.Controls.Add(btnGenKey);

            txtGeneratedKey = new TextBox();
            txtGeneratedKey.Font = GetAppFont(13f, FontStyle.Bold);
            txtGeneratedKey.ForeColor = Color.FromArgb(5, 150, 105);
            txtGeneratedKey.BackColor = Color.FromArgb(240, 253, 244);
            txtGeneratedKey.TextAlign = HorizontalAlignment.Center;
            txtGeneratedKey.ReadOnly = true;
            txtGeneratedKey.BorderStyle = BorderStyle.FixedSingle;
            txtGeneratedKey.Text = "ACTV-XXXX-XXXX-XXXX";
            txtGeneratedKey.Location = new Point(16, 118);
            txtGeneratedKey.Size = new Size(728, 28);
            cardGenerate.Controls.Add(txtGeneratedKey);

            // Action Buttons (2x2 Balanced Grid with 16px horizontal and 10px vertical gap)
            int btnColW = 356;
            int gapX = 16;

            // Row 1 - Left: Copy Key
            btnCopyKey = new ModernButton();
            btnCopyKey.Text = "📋 نسخ مفتاح التفعيل";
            btnCopyKey.Location = new Point(16, 160);
            btnCopyKey.Size = new Size(btnColW, 36);
            btnCopyKey.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnCopyKey.ApplyTheme(
                Color.FromArgb(5, 150, 105), Color.FromArgb(4, 120, 87),
                Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105),
                Color.FromArgb(6, 95, 70), Color.FromArgb(6, 78, 59),
                Color.FromArgb(4, 120, 87), Color.FromArgb(5, 150, 105),
                Color.White
            );
            btnCopyKey.Click += delegate
            {
                if (!string.IsNullOrEmpty(txtGeneratedKey.Text) && txtGeneratedKey.Text != "ACTV-XXXX-XXXX-XXXX")
                {
                    Clipboard.SetText(txtGeneratedKey.Text);
                    MessageBox.Show(
                        isArabic ? "✅ تم نسخ مفتاح التفعيل بنجاح في الحافظة:\n\n" + txtGeneratedKey.Text : "La clé d'activation a été copiée avec succès !",
                        isArabic ? "تم النسخ بنجاح" : "Succès",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
                else
                {
                    MessageBox.Show(
                        isArabic ? "يرجى أولاً الضغط على زر توليد المفتاح." : "Veuillez d'abord générer la clé.",
                        isArabic ? "تنبيه" : "Attention",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                }
            };
            cardGenerate.Controls.Add(btnCopyKey);

            // Row 1 - Right: Verify Key
            btnVerifyKey = new ModernButton();
            btnVerifyKey.Text = "🔍 فحص وتأكيد المفتاح";
            btnVerifyKey.Location = new Point(16 + btnColW + gapX, 160);
            btnVerifyKey.Size = new Size(btnColW, 36);
            btnVerifyKey.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnVerifyKey.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnVerifyKey.Click += delegate { DoVerifyLicense(); };
            cardGenerate.Controls.Add(btnVerifyKey);

            // Row 2 - Left: Activate Locally on this PC
            btnActivateThisPc = new ModernButton();
            btnActivateThisPc.Text = "🚀 تفعيل البرنامج فورياً على هذا الحاسوب";
            btnActivateThisPc.Location = new Point(16, 206);
            btnActivateThisPc.Size = new Size(btnColW, 36);
            btnActivateThisPc.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnActivateThisPc.ApplyTheme(
                Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105),
                Color.FromArgb(52, 211, 153), Color.FromArgb(16, 185, 129),
                Color.FromArgb(4, 120, 87), Color.FromArgb(6, 95, 70),
                Color.FromArgb(5, 150, 105), Color.FromArgb(16, 185, 129),
                Color.White
            );
            btnActivateThisPc.Click += delegate { DoActivateLocalMachine(); };
            cardGenerate.Controls.Add(btnActivateThisPc);

            // Row 2 - Right: Copy WhatsApp Message
            btnCopyMsg = new ModernButton();
            btnCopyMsg.Text = "💬 تجهيز ونسخ رسالة الواتساب للعميل";
            btnCopyMsg.Location = new Point(16 + btnColW + gapX, 206);
            btnCopyMsg.Size = new Size(btnColW, 36);
            btnCopyMsg.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnCopyMsg.ApplyTheme(
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(129, 140, 248), Color.FromArgb(99, 102, 241),
                Color.FromArgb(67, 56, 202), Color.FromArgb(55, 48, 163),
                Color.FromArgb(79, 70, 229), Color.FromArgb(99, 102, 241),
                Color.White
            );
            btnCopyMsg.Click += delegate
            {
                if (!string.IsNullOrEmpty(txtCustomerMessage.Text))
                {
                    Clipboard.SetText(txtCustomerMessage.Text);
                    MessageBox.Show(
                        isArabic ? "✅ تم نسخ نص الرسالة الكاملة في الحافظة، يمكنك لصقها وإرسالها للعميل في واتساب مباشرة!" : "Le message client a été copié dans le presse-papier !",
                        isArabic ? "تم النسخ" : "Succès",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
                else
                {
                    MessageBox.Show(
                        isArabic ? "يرجى أولاً توليد مفتاح التفعيل لتجهيز نص الرسالة." : "Veuillez d'abord générer la clé pour préparer le message.",
                        isArabic ? "تنبيه" : "Attention",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                }
            };
            cardGenerate.Controls.Add(btnCopyMsg);

            txtCustomerMessage = new TextBox();
            txtCustomerMessage.Visible = false;
            cardGenerate.Controls.Add(txtCustomerMessage);

            // 3. Support Footer Card
            cardSupportFooter = new ModernCard();
            cardSupportFooter.Location = new Point(0, 434);
            cardSupportFooter.Size = new Size(760, 114);
            cardSupportFooter.BackColor = DarkFooterBg;
            cardSupportFooter.BorderColor = Color.FromArgb(30, 41, 59);
            panelLicense.Controls.Add(cardSupportFooter);

            lblSupportTitle = new Label();
            lblSupportTitle.Text = "الدعم الفني المباشر ومبيعات التراخيص الرسمية :";
            lblSupportTitle.Font = GetAppFont(9f, FontStyle.Bold);
            lblSupportTitle.ForeColor = Color.FromArgb(251, 191, 36);
            lblSupportTitle.BackColor = Color.Transparent;
            lblSupportTitle.AutoSize = true;
            lblSupportTitle.Location = new Point(16, 12);
            cardSupportFooter.Controls.Add(lblSupportTitle);

            lblSupportContact = new Label();
            lblSupportContact.Text = "هاتف / واتساب : 0677212982";
            lblSupportContact.Font = GetAppFont(10.5f, FontStyle.Bold);
            lblSupportContact.ForeColor = Color.FromArgb(52, 211, 153);
            lblSupportContact.BackColor = Color.Transparent;
            lblSupportContact.AutoSize = true;
            lblSupportContact.Location = new Point(16, 42);
            cardSupportFooter.Controls.Add(lblSupportContact);

            lblSupportDesc = new Label();
            lblSupportDesc.Text = "مساعدة فورية وتفعيل دائم مدى الحياة مع ضمان استقرار العمل وعدم التوقف.";
            lblSupportDesc.Font = GetAppFont(8.25f, FontStyle.Regular);
            lblSupportDesc.ForeColor = Color.FromArgb(148, 163, 184);
            lblSupportDesc.BackColor = Color.Transparent;
            lblSupportDesc.AutoSize = true;
            lblSupportDesc.Location = new Point(16, 74);
            cardSupportFooter.Controls.Add(lblSupportDesc);
        }

        // ====================================================================
        // TAB 2: HISTORIQUE DES CLÉS
        // ====================================================================
        private void BuildKeysHistoryPanel()
        {
            panelKeysHistory = new Panel();
            panelKeysHistory.Location = new Point(12, 10);
            panelKeysHistory.Size = new Size(760, 566);
            panelKeysHistory.BackColor = WindowBg;
            pnlContent.Controls.Add(panelKeysHistory);

            cardHistoryHeader = new ModernCard();
            cardHistoryHeader.Location = new Point(0, 0);
            cardHistoryHeader.Size = new Size(760, 68);
            cardHistoryHeader.BackColor = CardBg;
            cardHistoryHeader.BorderColor = CardBorder;
            panelKeysHistory.Controls.Add(cardHistoryHeader);

            lblHistoryCount = new Label();
            lblHistoryCount.Text = "● سجل التراخيص والمفاتيح الصادرة :";
            lblHistoryCount.Font = GetAppFont(9f, FontStyle.Bold);
            lblHistoryCount.ForeColor = TextPrimary;
            lblHistoryCount.Location = new Point(16, 8);
            lblHistoryCount.AutoSize = true;
            cardHistoryHeader.Controls.Add(lblHistoryCount);

            txtSearchHistory = new TextBox();
            txtSearchHistory.Font = GetAppFont(9f, FontStyle.Regular);
            txtSearchHistory.Location = new Point(16, 30);
            txtSearchHistory.Size = new Size(185, 26);
            txtSearchHistory.BorderStyle = BorderStyle.FixedSingle;
            txtSearchHistory.TextChanged += delegate { FilterKeysHistory(); };
            cardHistoryHeader.Controls.Add(txtSearchHistory);

            btnCopyHistoryKey = new ModernButton();
            btnCopyHistoryKey.Text = "📋 نسخ المفتاح";
            btnCopyHistoryKey.Size = new Size(116, 30);
            btnCopyHistoryKey.Location = new Point(216, 28);
            btnCopyHistoryKey.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnCopyHistoryKey.ApplyTheme(
                Color.FromArgb(79, 70, 229), Color.FromArgb(67, 56, 202),
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(55, 48, 163), Color.FromArgb(49, 46, 129),
                Color.FromArgb(67, 56, 202), Color.FromArgb(79, 70, 229),
                Color.White
            );
            btnCopyHistoryKey.Click += delegate { DoCopySelectedHistoryKey(); };
            cardHistoryHeader.Controls.Add(btnCopyHistoryKey);

            btnActivateSelectedHistory = new ModernButton();
            btnActivateSelectedHistory.Text = "🚀 تفعيل هذا الحاسوب";
            btnActivateSelectedHistory.Size = new Size(150, 30);
            btnActivateSelectedHistory.Location = new Point(342, 28);
            btnActivateSelectedHistory.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnActivateSelectedHistory.ApplyTheme(
                Color.FromArgb(5, 150, 105), Color.FromArgb(4, 120, 87),
                Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105),
                Color.FromArgb(6, 95, 70), Color.FromArgb(6, 78, 59),
                Color.FromArgb(4, 120, 87), Color.FromArgb(5, 150, 105),
                Color.White
            );
            btnActivateSelectedHistory.Click += delegate { DoActivateSelectedHistoryKey(); };
            cardHistoryHeader.Controls.Add(btnActivateSelectedHistory);

            btnDeleteHistory = new ModernButton();
            btnDeleteHistory.Text = "🗑️ حذف";
            btnDeleteHistory.Size = new Size(92, 30);
            btnDeleteHistory.Location = new Point(502, 28);
            btnDeleteHistory.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnDeleteHistory.ApplyTheme(
                Color.FromArgb(220, 38, 38), Color.FromArgb(185, 28, 28),
                Color.FromArgb(239, 68, 68), Color.FromArgb(220, 38, 38),
                Color.FromArgb(153, 27, 27), Color.FromArgb(127, 29, 29),
                Color.FromArgb(185, 28, 28), Color.FromArgb(220, 38, 38),
                Color.White
            );
            btnDeleteHistory.Click += delegate { DoDeleteSelectedHistoryKey(); };
            cardHistoryHeader.Controls.Add(btnDeleteHistory);

            btnRefreshHistory = new ModernButton();
            btnRefreshHistory.Text = "🔄 تحديث";
            btnRefreshHistory.Size = new Size(95, 30);
            btnRefreshHistory.Location = new Point(604, 28);
            btnRefreshHistory.Font = GetAppFont(8.25f, FontStyle.Bold);
            btnRefreshHistory.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnRefreshHistory.Click += delegate
            {
                LoadKeysHistoryFromFile();
                FilterKeysHistory();
            };
            cardHistoryHeader.Controls.Add(btnRefreshHistory);

            // Table Card
            cardHistoryTable = new ModernCard();
            cardHistoryTable.Location = new Point(0, 76);
            cardHistoryTable.Size = new Size(760, 445);
            cardHistoryTable.BackColor = CardBg;
            cardHistoryTable.BorderColor = CardBorder;
            panelKeysHistory.Controls.Add(cardHistoryTable);

            dgvKeys = new DataGridView();
            dgvKeys.Dock = DockStyle.Fill;
            dgvKeys.BackgroundColor = CardBg;
            dgvKeys.BorderStyle = BorderStyle.None;
            dgvKeys.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
            dgvKeys.RowHeadersVisible = false;
            dgvKeys.AllowUserToAddRows = false;
            dgvKeys.AllowUserToDeleteRows = false;
            dgvKeys.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            dgvKeys.MultiSelect = false;
            dgvKeys.ReadOnly = true;
            dgvKeys.Font = GetAppFont(9f, FontStyle.Regular);
            dgvKeys.RowTemplate.Height = 34;
            dgvKeys.GridColor = Color.FromArgb(241, 245, 249);

            dgvKeys.EnableHeadersVisualStyles = false;
            dgvKeys.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(241, 245, 249);
            dgvKeys.ColumnHeadersDefaultCellStyle.ForeColor = Color.FromArgb(30, 41, 59);
            dgvKeys.ColumnHeadersDefaultCellStyle.Font = GetAppFont(9f, FontStyle.Bold);
            dgvKeys.ColumnHeadersHeight = 34;
            dgvKeys.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;

            dgvKeys.RowsDefaultCellStyle.BackColor = Color.White;
            dgvKeys.RowsDefaultCellStyle.ForeColor = TextPrimary;
            dgvKeys.RowsDefaultCellStyle.SelectionBackColor = Color.FromArgb(238, 242, 255);
            dgvKeys.RowsDefaultCellStyle.SelectionForeColor = Color.FromArgb(67, 56, 202);
            dgvKeys.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(248, 250, 252);
            dgvKeys.AlternatingRowsDefaultCellStyle.SelectionBackColor = Color.FromArgb(238, 242, 255);
            dgvKeys.AlternatingRowsDefaultCellStyle.SelectionForeColor = Color.FromArgb(67, 56, 202);

            DataGridViewTextBoxColumn colDate = new DataGridViewTextBoxColumn();
            colDate.HeaderText = "التاريخ";
            colDate.Width = 115;
            dgvKeys.Columns.Add(colDate);

            DataGridViewTextBoxColumn colCust = new DataGridViewTextBoxColumn();
            colCust.HeaderText = "العميل / المتجر";
            colCust.Width = 160;
            dgvKeys.Columns.Add(colCust);

            DataGridViewTextBoxColumn colMid = new DataGridViewTextBoxColumn();
            colMid.HeaderText = "معرف الجهاز (Machine ID)";
            colMid.Width = 170;
            dgvKeys.Columns.Add(colMid);

            DataGridViewTextBoxColumn colKey = new DataGridViewTextBoxColumn();
            colKey.HeaderText = "مفتاح التفعيل (License Key)";
            colKey.Width = 175;
            dgvKeys.Columns.Add(colKey);

            DataGridViewTextBoxColumn colType = new DataGridViewTextBoxColumn();
            colType.HeaderText = "النوع";
            colType.AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
            colType.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            dgvKeys.Columns.Add(colType);

            dgvKeys.CellFormatting += delegate(object s, DataGridViewCellFormattingEventArgs e)
            {
                try
                {
                    if (e.RowIndex < 0 || e.RowIndex >= dgvKeys.Rows.Count) return;

                    if (e.ColumnIndex == 0)
                    {
                        e.CellStyle.ForeColor = TextSecondary;
                        e.CellStyle.Font = GetAppFont(8.25f, FontStyle.Regular);
                    }
                    else if (e.ColumnIndex == 1)
                    {
                        e.CellStyle.ForeColor = TextPrimary;
                        e.CellStyle.Font = GetAppFont(9f, FontStyle.Bold);
                    }
                    else if (e.ColumnIndex == 2)
                    {
                        e.CellStyle.ForeColor = Color.FromArgb(71, 85, 105);
                        e.CellStyle.Font = GetAppFont(9.5f, FontStyle.Bold);
                    }
                    else if (e.ColumnIndex == 3)
                    {
                        e.CellStyle.ForeColor = Color.FromArgb(5, 150, 105);
                        e.CellStyle.Font = GetAppFont(10f, FontStyle.Bold);
                    }
                    else if (e.ColumnIndex == 4)
                    {
                        e.CellStyle.ForeColor = Color.FromArgb(4, 120, 87);
                        e.CellStyle.Font = GetAppFont(8.25f, FontStyle.Bold);
                        e.Value = isArabic ? "🟢 دائم مدى الحياة" : "🟢 Permanente (À vie)";
                    }
                }
                catch { }
            };

            dgvKeys.CellDoubleClick += delegate(object s, DataGridViewCellEventArgs e)
            {
                if (e.RowIndex >= 0 && e.RowIndex < dgvKeys.Rows.Count)
                {
                    string key = Convert.ToString(dgvKeys.Rows[e.RowIndex].Cells[3].Value);
                    string cust = Convert.ToString(dgvKeys.Rows[e.RowIndex].Cells[1].Value);
                    if (!string.IsNullOrEmpty(key))
                    {
                        Clipboard.SetText(key);
                        lblCurrentStatus.Text = string.Format(isArabic ? "الحالة : تم نسخ المفتاح لـ [{0}] : {1} ✓" : "Statut : Clé copiée pour [{0}] : {1} ✓", cust, key);
                        MessageBox.Show(
                            (isArabic ? "✅ تم نسخ مفتاح التفعيل بنجاح في الحافظة:\n\n" : "Clé copiée avec succès :\n\n") + key + "\n\n(" + (isArabic ? "العميل: " : "Client: ") + cust + ")",
                            isArabic ? "تم النسخ بنجاح ✓" : "Succès ✓",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information);
                    }
                }
            };
            cardHistoryTable.Controls.Add(dgvKeys);

            lblTableTip = new Label();
            lblTableTip.Text = "💡 نقرة مزدوجة على أي سطر لنسخ المفتاح مباشرة في الحافظة";
            lblTableTip.Font = GetAppFont(8f, FontStyle.Italic);
            lblTableTip.ForeColor = TextMuted;
            lblTableTip.Location = new Point(4, 528);
            lblTableTip.AutoSize = true;
            panelKeysHistory.Controls.Add(lblTableTip);
        }

        private void LoadKeysHistoryFromFile()
        {
            try
            {
                string jsonPath = Path.Combine(Application.StartupPath, "generated_keys.json");
                if (File.Exists(jsonPath))
                {
                    string json = File.ReadAllText(jsonPath, Encoding.UTF8);
                    allHistoryItems = ParseKeysJson(json);
                }
            }
            catch (Exception ex)
            {
                AppendLog("History load warning : " + ex.Message);
            }
        }

        private void SaveKeysHistoryToFile()
        {
            try
            {
                string jsonPath = Path.Combine(Application.StartupPath, "generated_keys.json");
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("[");
                for (int i = 0; i < allHistoryItems.Count; i++)
                {
                    var item = allHistoryItems[i];
                    sb.Append("  {");
                    sb.AppendFormat("\"date\":\"{0}\",", EscapeJson(item.Date));
                    sb.AppendFormat("\"customer\":\"{0}\",", EscapeJson(item.Customer));
                    sb.AppendFormat("\"machineId\":\"{0}\",", EscapeJson(item.MachineId));
                    sb.AppendFormat("\"key\":\"{0}\",", EscapeJson(item.Key));
                    sb.AppendFormat("\"licenseType\":\"{0}\"", EscapeJson(item.LicenseType));
                    sb.Append("}");
                    if (i < allHistoryItems.Count - 1) sb.Append(",");
                    sb.AppendLine();
                }
                sb.AppendLine("]");
                File.WriteAllText(jsonPath, sb.ToString(), Encoding.UTF8);
            }
            catch (Exception ex)
            {
                AppendLog("History save warning : " + ex.Message);
            }
        }

        private void FilterKeysHistory()
        {
            dgvKeys.Rows.Clear();
            string query = txtSearchHistory.Text != null ? txtSearchHistory.Text.Trim().ToLowerInvariant() : "";

            foreach (var item in allHistoryItems)
            {
                if (string.IsNullOrEmpty(query) ||
                    (item.Customer != null && item.Customer.ToLowerInvariant().Contains(query)) ||
                    (item.MachineId != null && item.MachineId.ToLowerInvariant().Contains(query)) ||
                    (item.Key != null && item.Key.ToLowerInvariant().Contains(query)) ||
                    (item.Date != null && item.Date.ToLowerInvariant().Contains(query)))
                {
                    dgvKeys.Rows.Add(item.Date, item.Customer, item.MachineId, item.Key, item.LicenseType);
                }
            }

            if (lblHistoryCount != null)
            {
                lblHistoryCount.Text = isArabic 
                    ? string.Format("● سجل التراخيص والمفاتيح الصادرة ({0} مسجلة) :", allHistoryItems.Count)
                    : string.Format("● Historique des Licences & Clés ({0} enregistrées) :", allHistoryItems.Count);
            }
        }

        private void DoCopySelectedHistoryKey()
        {
            if (dgvKeys.SelectedRows.Count > 0)
            {
                int idx = dgvKeys.SelectedRows[0].Index;
                string key = Convert.ToString(dgvKeys.Rows[idx].Cells[3].Value);
                string cust = Convert.ToString(dgvKeys.Rows[idx].Cells[1].Value);
                if (!string.IsNullOrEmpty(key))
                {
                    Clipboard.SetText(key);
                    lblCurrentStatus.Text = string.Format(isArabic ? "الحالة : تم نسخ المفتاح لـ [{0}] : {1} ✓" : "Statut : Clé copiée pour [{0}] : {1} ✓", cust, key);
                    MessageBox.Show(
                        (isArabic ? "✅ تم نسخ مفتاح التفعيل بنجاح في الحافظة:\n\n" : "Clé copiée avec succès :\n\n") + key + "\n\n(" + (isArabic ? "المرخص له: " : "Licencié: ") + cust + ")",
                        isArabic ? "تم النسخ بنجاح ✓" : "Succès ✓",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
            }
            else
            {
                MessageBox.Show(
                    isArabic ? "يرجى تحديد سطر من الجدول أولاً." : "Veuillez d'abord sélectionner une ligne dans le tableau.",
                    isArabic ? "تنبيه" : "Attention",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        private void DoActivateSelectedHistoryKey()
        {
            if (dgvKeys.SelectedRows.Count > 0)
            {
                int idx = dgvKeys.SelectedRows[0].Index;
                string mid = Convert.ToString(dgvKeys.Rows[idx].Cells[2].Value);
                string key = Convert.ToString(dgvKeys.Rows[idx].Cells[3].Value);
                string cust = Convert.ToString(dgvKeys.Rows[idx].Cells[1].Value);
                DoActivateLocalMachine(mid, key, cust);
            }
            else
            {
                MessageBox.Show(
                    isArabic ? "يرجى تحديد ترخيص من الجدول أولاً." : "Veuillez d'abord sélectionner une licence dans le tableau.",
                    isArabic ? "تنبيه" : "Attention",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        private void DoDeleteSelectedHistoryKey()
        {
            if (dgvKeys.SelectedRows.Count > 0)
            {
                int idx = dgvKeys.SelectedRows[0].Index;
                string mid = Convert.ToString(dgvKeys.Rows[idx].Cells[2].Value);
                string key = Convert.ToString(dgvKeys.Rows[idx].Cells[3].Value);
                string cust = Convert.ToString(dgvKeys.Rows[idx].Cells[1].Value);

                DialogResult dr = MessageBox.Show(
                    (isArabic ? "هل أنت متأكد من حذف هذا السجل؟\n\nالعميل: " : "Confirmez-vous la suppression ?\nClient: ") + cust + "\nKey: " + key,
                    isArabic ? "تأكيد الحذف" : "Confirmation",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question);

                if (dr == DialogResult.Yes)
                {
                    allHistoryItems.RemoveAll(h => string.Equals(h.Key, key, StringComparison.OrdinalIgnoreCase));
                    SaveKeysHistoryToFile();
                    FilterKeysHistory();
                }
            }
        }

        // ====================================================================
        // TAB 3: BASE DE DONNÉES & MAINTENANCE
        // ====================================================================
        private void BuildDatabasePanel()
        {
            panelDatabase = new Panel();
            panelDatabase.Location = new Point(12, 10);
            panelDatabase.Size = new Size(760, 566);
            panelDatabase.BackColor = WindowBg;
            pnlContent.Controls.Add(panelDatabase);

            // Card 1: Clean DB for Sale
            cardDbClean = new ModernCard();
            cardDbClean.Location = new Point(0, 0);
            cardDbClean.Size = new Size(760, 120);
            cardDbClean.BackColor = CardBg;
            cardDbClean.BorderColor = CardBorder;
            panelDatabase.Controls.Add(cardDbClean);

            lblDbC1Title = new Label();
            lblDbC1Title.Text = "إنشاء قاعدة بيانات إنتاجية نظيفة للبيع والتوزيع (database_clean.sqlite)";
            lblDbC1Title.Font = GetAppFont(9.5f, FontStyle.Bold);
            lblDbC1Title.ForeColor = Color.FromArgb(5, 150, 105);
            lblDbC1Title.Location = new Point(14, 10);
            lblDbC1Title.AutoSize = true;
            cardDbClean.Controls.Add(lblDbC1Title);

            lblDbC1Desc = new Label();
            lblDbC1Desc.Text = "تجهيز قاعدة بيانات خالية تماماً من فواتير ومنتجات الاختبار التجريبية، جاهزة للبيع للزبون مع الحساب الافتراضي (admin/smartpos).";
            lblDbC1Desc.Font = GetAppFont(8.25f, FontStyle.Regular);
            lblDbC1Desc.ForeColor = TextSecondary;
            lblDbC1Desc.Location = new Point(14, 32);
            lblDbC1Desc.AutoSize = true;
            cardDbClean.Controls.Add(lblDbC1Desc);

            btnCreateCleanDb = new ModernButton();
            btnCreateCleanDb.Text = "⚡ إنشاء وتحديث database_clean.sqlite";
            btnCreateCleanDb.Font = GetAppFont(9f, FontStyle.Bold);
            btnCreateCleanDb.Size = new Size(320, 36);
            btnCreateCleanDb.Location = new Point(14, 66);
            btnCreateCleanDb.ApplyTheme(
                Color.FromArgb(5, 150, 105), Color.FromArgb(4, 120, 87),
                Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105),
                Color.FromArgb(6, 95, 70), Color.FromArgb(6, 78, 59),
                Color.FromArgb(4, 120, 87), Color.FromArgb(5, 150, 105),
                Color.White
            );
            btnCreateCleanDb.Click += delegate { DoRunCleanDb(false); };
            cardDbClean.Controls.Add(btnCreateCleanDb);

            // Card 2: Reset Main DB
            cardDbReset = new ModernCard();
            cardDbReset.Location = new Point(0, 130);
            cardDbReset.Size = new Size(760, 120);
            cardDbReset.BackColor = CardBg;
            cardDbReset.BorderColor = CardBorder;
            panelDatabase.Controls.Add(cardDbReset);

            lblDbC2Title = new Label();
            lblDbC2Title.Text = "تفريغ وإعادة ضبط القاعدة المحلية الحالية (database.sqlite)";
            lblDbC2Title.Font = GetAppFont(9.5f, FontStyle.Bold);
            lblDbC2Title.ForeColor = Color.FromArgb(217, 119, 6);
            lblDbC2Title.Location = new Point(14, 10);
            lblDbC2Title.AutoSize = true;
            cardDbReset.Controls.Add(lblDbC2Title);

            lblDbC2Desc = new Label();
            lblDbC2Desc.Text = "حذف سجلات الاختبار والبدء من جديد. سيتم دائماً إنشاء نسخة احتياطية آمنة في مجلد /backups قبل أي عملية تفريغ.";
            lblDbC2Desc.Font = GetAppFont(8.25f, FontStyle.Regular);
            lblDbC2Desc.ForeColor = TextSecondary;
            lblDbC2Desc.Location = new Point(14, 32);
            lblDbC2Desc.AutoSize = true;
            cardDbReset.Controls.Add(lblDbC2Desc);

            btnCleanMainDb = new ModernButton();
            btnCleanMainDb.Text = "⚠️ تفريغ وإعادة تعيين database.sqlite الحالية";
            btnCleanMainDb.Font = GetAppFont(9f, FontStyle.Bold);
            btnCleanMainDb.Size = new Size(320, 36);
            btnCleanMainDb.Location = new Point(14, 66);
            btnCleanMainDb.ApplyTheme(
                Color.FromArgb(217, 119, 6), Color.FromArgb(180, 83, 9),
                Color.FromArgb(245, 158, 11), Color.FromArgb(217, 119, 6),
                Color.FromArgb(146, 64, 14), Color.FromArgb(120, 53, 15),
                Color.FromArgb(180, 83, 9), Color.FromArgb(217, 119, 6),
                Color.White
            );
            btnCleanMainDb.Click += delegate
            {
                DialogResult dr = MessageBox.Show(
                    isArabic ? "هل أنت متأكد تماماً من رغبتك في تفريغ قاعدة البيانات الحالية؟\n\nسيتم حفظ نسخة احتياطية تلقائياً قبل البدء." : "Êtes-vous certain de vouloir réinitialiser la base locale ?\nUne sauvegarde de secours sera conservée.",
                    isArabic ? "تأكيد العملية" : "Confirmation Requise",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (dr == DialogResult.Yes)
                {
                    DoRunCleanDb(true);
                }
            };
            cardDbReset.Controls.Add(btnCleanMainDb);

            // Card 3: Folders Quick Access
            cardDbFolders = new ModernCard();
            cardDbFolders.Location = new Point(0, 260);
            cardDbFolders.Size = new Size(760, 95);
            cardDbFolders.BackColor = CardBg;
            cardDbFolders.BorderColor = CardBorder;
            panelDatabase.Controls.Add(cardDbFolders);

            lblDbC3Title = new Label();
            lblDbC3Title.Text = "الوصول السريع إلى المجلدات والملفات الرئيسية :";
            lblDbC3Title.Font = GetAppFont(9f, FontStyle.Bold);
            lblDbC3Title.ForeColor = TextPrimary;
            lblDbC3Title.Location = new Point(14, 12);
            lblDbC3Title.AutoSize = true;
            cardDbFolders.Controls.Add(lblDbC3Title);

            btnOpenDbFolder = new ModernButton();
            btnOpenDbFolder.Text = "📁 مجلد البرنامج الرئيسي";
            btnOpenDbFolder.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnOpenDbFolder.Size = new Size(230, 34);
            btnOpenDbFolder.Location = new Point(14, 44);
            btnOpenDbFolder.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnOpenDbFolder.Click += delegate { OpenFolder(Application.StartupPath); };
            cardDbFolders.Controls.Add(btnOpenDbFolder);

            btnOpenBackupFolder = new ModernButton();
            btnOpenBackupFolder.Text = "📂 مجلد النسخ الاحتياطية (backups)";
            btnOpenBackupFolder.Font = GetAppFont(8.5f, FontStyle.Bold);
            btnOpenBackupFolder.Size = new Size(250, 34);
            btnOpenBackupFolder.Location = new Point(256, 44);
            btnOpenBackupFolder.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnOpenBackupFolder.Click += delegate
            {
                string bakPath = Path.Combine(Application.StartupPath, "backups");
                if (!Directory.Exists(bakPath)) Directory.CreateDirectory(bakPath);
                OpenFolder(bakPath);
            };
            cardDbFolders.Controls.Add(btnOpenBackupFolder);
        }

        private void DoRunCleanDb(bool applyToMain)
        {
            if (isRunningTask)
            {
                MessageBox.Show(
                    isArabic ? "هناك عملية قيد التنفيذ حالياً، يرجى الانتظار..." : "Une opération est déjà en cours. Veuillez patienter...",
                    isArabic ? "تنبيه" : "Information",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            string scriptPath = Path.Combine(Application.StartupPath, "scripts", "create_clean_production_db.cjs");
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show("Script not found: " + scriptPath, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            SwitchTab(4);

            string args = applyToMain ? string.Format("\"{0}\" --apply-to-main", scriptPath) : string.Format("\"{0}\"", scriptPath);
            string taskTitle = applyToMain ? (isArabic ? "تفريغ وتعيين القاعدة الرئيسية" : "Purger base locale") : (isArabic ? "إنشاء database_clean.sqlite" : "Créer base vierge");

            RunNodeProcessAsync(taskTitle, args, delegate
            {
                RefreshStatusBadges();
            });
        }

        // ====================================================================
        // TAB 4: COMPILATION & SETUP BUILD
        // ====================================================================
        private void BuildBuildPanel()
        {
            panelBuild = new Panel();
            panelBuild.Location = new Point(12, 10);
            panelBuild.Size = new Size(760, 566);
            panelBuild.BackColor = WindowBg;
            pnlContent.Controls.Add(panelBuild);

            cardBuildMain = new ModernCard();
            cardBuildMain.Location = new Point(0, 0);
            cardBuildMain.Size = new Size(760, 260);
            cardBuildMain.BackColor = CardBg;
            cardBuildMain.BorderColor = CardBorder;
            panelBuild.Controls.Add(cardBuildMain);

            lblBTitle = new Label();
            lblBTitle.Text = "تجميع وبناء مثبت الويندوز الشامل النهائي (Setup-SmartPOS.exe)";
            lblBTitle.Font = GetAppFont(10.5f, FontStyle.Bold);
            lblBTitle.ForeColor = Color.FromArgb(79, 70, 229);
            lblBTitle.Location = new Point(14, 12);
            lblBTitle.AutoSize = true;
            cardBuildMain.Controls.Add(lblBTitle);

            lblBDesc = new Label();
            lblBDesc.Text = "يقوم ببناء الواجهة الأمامية، خادم Node.js، ودمج قاعدة البيانات النظيفة مع ملف التثبيت الموحد لتسليمه للزبون لتثبيته بضغطة زر واحدة.";
            lblBDesc.Font = GetAppFont(8.25f, FontStyle.Regular);
            lblBDesc.ForeColor = TextSecondary;
            lblBDesc.Location = new Point(14, 36);
            lblBDesc.AutoSize = true;
            cardBuildMain.Controls.Add(lblBDesc);

            chkCleanDbBeforeBuild = new CheckBox();
            chkCleanDbBeforeBuild.Text = "ضمان تجهيز قاعدة بيانات نظيفة database_clean.sqlite قبل التجميع";
            chkCleanDbBeforeBuild.Font = GetAppFont(8.5f, FontStyle.Regular);
            chkCleanDbBeforeBuild.ForeColor = TextPrimary;
            chkCleanDbBeforeBuild.Location = new Point(14, 68);
            chkCleanDbBeforeBuild.Checked = true;
            chkCleanDbBeforeBuild.AutoSize = true;
            cardBuildMain.Controls.Add(chkCleanDbBeforeBuild);

            chkOpenFolderOnComplete = new CheckBox();
            chkOpenFolderOnComplete.Text = "فتح مجلد Final-Release تلقائياً فور اكتمال البناء";
            chkOpenFolderOnComplete.Font = GetAppFont(8.5f, FontStyle.Regular);
            chkOpenFolderOnComplete.ForeColor = TextPrimary;
            chkOpenFolderOnComplete.Location = new Point(14, 96);
            chkOpenFolderOnComplete.Checked = true;
            chkOpenFolderOnComplete.AutoSize = true;
            cardBuildMain.Controls.Add(chkOpenFolderOnComplete);

            btnStartBuild = new ModernButton();
            btnStartBuild.Text = "⚡ بدء التجميع وبناء مثبت الويندوز النهائي";
            btnStartBuild.Font = GetAppFont(10f, FontStyle.Bold);
            btnStartBuild.Size = new Size(330, 42);
            btnStartBuild.Location = new Point(14, 136);
            btnStartBuild.ApplyTheme(
                Color.FromArgb(79, 70, 229), Color.FromArgb(67, 56, 202),
                Color.FromArgb(99, 102, 241), Color.FromArgb(79, 70, 229),
                Color.FromArgb(55, 48, 163), Color.FromArgb(49, 46, 129),
                Color.FromArgb(67, 56, 202), Color.FromArgb(79, 70, 229),
                Color.White
            );
            btnStartBuild.Click += delegate { DoRunBuildInstaller(); };
            cardBuildMain.Controls.Add(btnStartBuild);

            btnOpenReleaseFolder = new ModernButton();
            btnOpenReleaseFolder.Text = "📂 مجلد Final-Release";
            btnOpenReleaseFolder.Font = GetAppFont(9f, FontStyle.Bold);
            btnOpenReleaseFolder.Size = new Size(210, 42);
            btnOpenReleaseFolder.Location = new Point(356, 136);
            btnOpenReleaseFolder.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnOpenReleaseFolder.Click += delegate
            {
                string relPath = Path.Combine(Application.StartupPath, "Final-Release");
                if (!Directory.Exists(relPath)) Directory.CreateDirectory(relPath);
                OpenFolder(relPath);
            };
            cardBuildMain.Controls.Add(btnOpenReleaseFolder);
        }

        private void DoRunBuildInstaller()
        {
            if (isRunningTask)
            {
                MessageBox.Show(
                    isArabic ? "هناك عملية بناء قيد التنفيذ حالياً." : "Une opération est déjà en cours d'exécution.",
                    isArabic ? "تنبيه" : "Information",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            string scriptPath = Path.Combine(Application.StartupPath, "scripts", "build_installer.cjs");
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show("Build script not found: " + scriptPath, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            SwitchTab(4);

            string args = string.Format("\"{0}\"", scriptPath);
            RunNodeProcessAsync("بناء مثبت الويندوز Setup-SmartPOS.exe", args, delegate
            {
                RefreshStatusBadges();
                if (chkOpenFolderOnComplete.Checked)
                {
                    string finalDir = Path.Combine(Application.StartupPath, "Final-Release");
                    if (Directory.Exists(finalDir)) OpenFolder(finalDir);
                }
            });
        }

        // ====================================================================
        // TAB 5: JOURNAL D'ACTIVITÉ (LOGS)
        // ====================================================================
        private void BuildLogsPanel()
        {
            panelLogs = new Panel();
            panelLogs.Location = new Point(12, 10);
            panelLogs.Size = new Size(760, 566);
            panelLogs.BackColor = WindowBg;
            pnlContent.Controls.Add(panelLogs);

            cardLogs = new ModernCard();
            cardLogs.Dock = DockStyle.Fill;
            cardLogs.BackColor = CardBg;
            cardLogs.BorderColor = CardBorder;
            panelLogs.Controls.Add(cardLogs);

            Panel pnlLogHead = new Panel();
            pnlLogHead.Dock = DockStyle.Top;
            pnlLogHead.Height = 40;
            pnlLogHead.Padding = new Padding(12, 5, 12, 5);
            cardLogs.Controls.Add(pnlLogHead);

            lblLogTitle = new Label();
            lblLogTitle.Text = "سجل العمليات والأحداث المباشر :";
            lblLogTitle.Font = GetAppFont(9f, FontStyle.Bold);
            lblLogTitle.ForeColor = TextPrimary;
            lblLogTitle.Location = new Point(12, 10);
            lblLogTitle.AutoSize = true;
            pnlLogHead.Controls.Add(lblLogTitle);

            Panel pnlLogActions = new Panel();
            pnlLogActions.Dock = DockStyle.Right;
            pnlLogActions.Width = 190;
            pnlLogHead.Controls.Add(pnlLogActions);

            btnClearLog = new ModernButton();
            btnClearLog.Text = "مسح السجل";
            btnClearLog.Size = new Size(85, 26);
            btnClearLog.Location = new Point(6, 6);
            btnClearLog.Font = GetAppFont(8f, FontStyle.Bold);
            btnClearLog.ApplyTheme(
                Color.FromArgb(241, 245, 249), Color.FromArgb(226, 232, 240),
                Color.FromArgb(226, 232, 240), Color.FromArgb(203, 213, 225),
                Color.FromArgb(203, 213, 225), Color.FromArgb(148, 163, 184),
                Color.FromArgb(203, 213, 225), Color.FromArgb(148, 163, 184),
                TextSecondary
            );
            btnClearLog.Click += delegate
            {
                txtLog.Clear();
                AppendLog(isArabic ? "تم مسح السجل." : "Journal effacé.");
            };
            pnlLogActions.Controls.Add(btnClearLog);

            btnCopyLog = new ModernButton();
            btnCopyLog.Text = "نسخ السجل";
            btnCopyLog.Size = new Size(85, 26);
            btnCopyLog.Location = new Point(96, 6);
            btnCopyLog.Font = GetAppFont(8f, FontStyle.Bold);
            btnCopyLog.ApplyTheme(
                Color.FromArgb(71, 85, 105), Color.FromArgb(51, 65, 85),
                Color.FromArgb(100, 116, 139), Color.FromArgb(71, 85, 105),
                Color.FromArgb(30, 41, 59), Color.FromArgb(15, 23, 42),
                Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105),
                Color.White
            );
            btnCopyLog.Click += delegate
            {
                if (!string.IsNullOrEmpty(txtLog.Text))
                {
                    Clipboard.SetText(txtLog.Text);
                    MessageBox.Show(
                        isArabic ? "تم نسخ السجل الكامل في الحافظة." : "Le journal a été copié dans le presse-papier.",
                        isArabic ? "تم النسخ" : "Information",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
            };
            pnlLogActions.Controls.Add(btnCopyLog);

            txtLog = new TextBox();
            txtLog.Dock = DockStyle.Fill;
            txtLog.Multiline = true;
            txtLog.ScrollBars = ScrollBars.Both;
            txtLog.ReadOnly = true;
            txtLog.BackColor = Color.FromArgb(15, 23, 42);
            txtLog.ForeColor = Color.FromArgb(241, 245, 249);
            txtLog.Font = GetAppFont(8.5f, FontStyle.Regular);
            txtLog.BorderStyle = BorderStyle.None;
            cardLogs.Controls.Add(txtLog);
            txtLog.BringToFront();
        }

        // ====================================================================
        // ASYNC NODE PROCESS EXECUTION
        // ====================================================================
        private void RunNodeProcessAsync(string title, string arguments, Action onComplete)
        {
            if (isRunningTask) return;
            isRunningTask = true;
            progressBar.Visible = true;
            progressBar.Style = ProgressBarStyle.Marquee;
            lblCurrentStatus.Text = string.Format(isArabic ? "الحالة : {0} جاري التنفيذ..." : "Statut : {0} en cours...", title);

            AppendLog("======================================================================");
            AppendLog(string.Format("▶ بدء تنفيذ : {0}", title));
            AppendLog(string.Format("الوقت : {0}", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")));
            AppendLog("======================================================================");

            string nodeExe = "node";
            string[] nodeCandidates = new string[] {
                Path.Combine(Application.StartupPath, "runtime", "node.exe"),
                @"C:SmartPOSuntime
ode.exe",
                @"C:Program Files
odejs
ode.exe"
            };
            foreach (string nc in nodeCandidates)
            {
                if (File.Exists(nc)) { nodeExe = nc; break; }
            }

            Thread thread = new Thread(delegate()
            {
                int exitCode = -1;
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = nodeExe;
                    psi.Arguments = arguments;
                    psi.WorkingDirectory = Application.StartupPath;
                    psi.UseShellExecute = false;
                    psi.RedirectStandardOutput = true;
                    psi.RedirectStandardError = true;
                    psi.CreateNoWindow = true;
                    psi.StandardOutputEncoding = Encoding.UTF8;
                    psi.StandardErrorEncoding = Encoding.UTF8;

                    currentProcess = new Process();
                    currentProcess.StartInfo = psi;

                    currentProcess.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
                    {
                        if (e.Data != null)
                        {
                            AppendLog(e.Data);
                        }
                    };

                    currentProcess.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
                    {
                        if (e.Data != null)
                        {
                            AppendLog("[ERR] " + e.Data);
                        }
                    };

                    currentProcess.Start();
                    currentProcess.BeginOutputReadLine();
                    currentProcess.BeginErrorReadLine();
                    currentProcess.WaitForExit();
                    exitCode = currentProcess.ExitCode;
                }
                catch (Exception ex)
                {
                    AppendLog("❌ خطأ أثناء تشغيل العملية: " + ex.Message);
                }
                finally
                {
                    currentProcess = null;
                    if (this.IsHandleCreated && !this.IsDisposed)
                    {
                        this.BeginInvoke((MethodInvoker)delegate
                        {
                            isRunningTask = false;
                            progressBar.Style = ProgressBarStyle.Continuous;
                            progressBar.Value = 0;
                            progressBar.Visible = false;

                            if (exitCode == 0)
                            {
                                lblCurrentStatus.Text = string.Format(isArabic ? "الحالة : تم اكتمال [{0}] بنجاح ✓" : "Statut : {0} terminé avec succès ✓", title);
                                AppendLog(string.Format(isArabic ? "🎉 اكتملت العملية [{0}] بنجاح تام!" : "Opération [{0}] terminée avec succès !", title));
                            }
                            else
                            {
                                lblCurrentStatus.Text = string.Format(isArabic ? "الحالة : انتهت العملية مع كود ({0})" : "Statut : Terminé avec code ({0})", exitCode);
                                AppendLog(string.Format("⚠️ انتهت العملية مع كود الخروج : {0}", exitCode));
                            }

                            if (onComplete != null) onComplete();
                        });
                    }
                }
            });

            thread.IsBackground = true;
            thread.Start();
        }

        private void AppendLog(string message)
        {
            if (this.InvokeRequired)
            {
                if (this.IsHandleCreated && !this.IsDisposed)
                {
                    this.BeginInvoke((MethodInvoker)delegate { AppendLog(message); });
                }
                return;
            }

            txtLog.AppendText(message + Environment.NewLine);
            txtLog.SelectionStart = txtLog.Text.Length;
            txtLog.ScrollToCaret();
        }

        // Asynchronous non-blocking status refresh (Runs on background thread so UI never freezes)
        private void RefreshStatusBadges()
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    bool serverOnline = false;
                    try
                    {
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/api/license/status");
                        req.Timeout = 400;
                        using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                        {
                            if (res.StatusCode == HttpStatusCode.OK) serverOnline = true;
                        }
                    }
                    catch { }

                    string baseDir = Application.StartupPath;
                    string mainDb = Path.Combine(baseDir, "database.sqlite");
                    long dbBytes = 0;
                    bool dbExists = false;
                    if (File.Exists(mainDb))
                    {
                        FileInfo fi = new FileInfo(mainDb);
                        dbBytes = fi.Length;
                        dbExists = true;
                    }

                    if (this.IsDisposed || !this.IsHandleCreated) return;
                    this.BeginInvoke((MethodInvoker)delegate
                    {
                        try
                        {
                            if (serverOnline)
                            {
                                lblStatusServer.Text = isArabic ? "🟢 السيرفر: شغال" : "🟢 Serveur : Actif";
                                lblStatusServer.BackColor = Color.FromArgb(50, 16, 185, 129);
                                lblStatusServer.ForeColor = Color.FromArgb(209, 250, 229);
                            }
                            else
                            {
                                lblStatusServer.Text = isArabic ? "⚪ السيرفر: مطفأ" : "⚪ Serveur : Off";
                                lblStatusServer.BackColor = Color.FromArgb(30, 255, 255, 255);
                                lblStatusServer.ForeColor = Color.FromArgb(226, 232, 240);
                            }

                            if (dbExists)
                            {
                                lblStatusDb.Text = isArabic 
                                    ? string.Format("🗄️ القاعدة: {0} ك.ب", dbBytes / 1024) 
                                    : string.Format("BD : {0} Ko", dbBytes / 1024);
                                lblStatusDb.BackColor = Color.FromArgb(45, 255, 255, 255);
                                lblStatusDb.ForeColor = Color.FromArgb(209, 250, 229);
                            }
                            else
                            {
                                lblStatusDb.Text = isArabic ? "القاعدة: غير موجودة" : "BD : Absente";
                                lblStatusDb.BackColor = Color.FromArgb(30, 255, 255, 255);
                                lblStatusDb.ForeColor = Color.FromArgb(241, 245, 249);
                            }
                        }
                        catch { }
                    });
                }
                catch { }
            });
        }

        // ====================================================================
        // LANGUAGE LOCALIZATION (Smooth Switch - Never destroys window handle)
        // ====================================================================
        private void ApplyLanguage(bool arabic)
        {
            isArabic = arabic;

            pnlSidebar.Dock = arabic ? DockStyle.Right : DockStyle.Left;
            pnlSidebar.SendToBack();
            pnlMainContainer.BringToFront();

            if (arabic)
            {
                this.Text = "SmartPOS Pro — أداة المطور والإدارة الرئيسية";
                btnLangToggle.Text = "🌐  Français";

                lblSidebarTitle.Text = "SmartPOS Pro";
                lblSidebarSubtitle.Text = "لوحة أدوات المطور والإدارة";
                lblNavCategory.Text = "الأقسام الرئيسية";

                lblSupportTitleSidebar.Text = "الدعم الفني والمبيعات :";
                lblSupportContactSidebar.Text = "0677212982";
                lblSupportDescSidebar.Text = "مساعدة فورية وتفعيل دائم";

                btnTabLicense.Text     = "التراخيص والتفعيل";
                btnTabKeysHistory.Text = "سجل المفاتيح";
                btnTabDatabase.Text    = "قاعدة البيانات";
                btnTabBuild.Text       = "بناء الحزمة";
                btnTabLogs.Text        = "سجل العمليات";

                lblMidHeader.Text = "معرف الجهاز الخاص بالزبون (Machine ID) :";
                lblMidHint.Text = "✦ المعرف العتادي للجهاز (انسخ المعرف الظاهر في شاشة الزبون وألصقه هنا لتوليد ترخيصه الدائم).";
                lblCustHeader.Text = "اسم الزبون أو المحل التجاري (اختياري) :";
                if (txtCustomerName.Text == "Magasin / Entreprise") txtCustomerName.Text = "المحل التجاري";
                btnPasteMachineId.Text = "📋 لصق المعرف";
                btnUseThisPcId.Text = "💻 هذا الحاسوب";
                btnGenKey.Text = "⚡ توليد مفتاح التفعيل الرسمي الدائم (Generate License Key)";
                btnCopyKey.Text = "📋 نسخ مفتاح التفعيل";
                btnVerifyKey.Text = "🔍 فحص وتأكيد المفتاح";
                btnActivateThisPc.Text = "🚀 تفعيل البرنامج فورياً على هذا الحاسوب";
                btnCopyMsg.Text = "💬 تجهيز ونسخ رسالة الواتساب للعميل";

                lblSupportTitle.Text = "الدعم الفني المباشر ومبيعات التراخيص الرسمية :";
                lblSupportContact.Text = "هاتف / واتساب : 0677212982";
                lblSupportDesc.Text = "مساعدة فورية وتفعيل دائم مدى الحياة مع ضمان استقرار العمل وعدم التوقف.";

                lblHistoryCount.Text = string.Format("● سجل التراخيص والمفاتيح الصادرة ({0} مسجلة) :", allHistoryItems.Count);
                btnCopyHistoryKey.Text = "📋 نسخ المفتاح";
                btnActivateSelectedHistory.Text = "🚀 تفعيل هذا الحاسوب";
                btnDeleteHistory.Text = "🗑️ حذف";
                btnRefreshHistory.Text = "🔄 تحديث";
                lblTableTip.Text = "💡 نقرة مزدوجة على أي سطر لنسخ المفتاح مباشرة في الحافظة";

                if (dgvKeys != null && dgvKeys.Columns.Count >= 5)
                {
                    dgvKeys.Columns[0].HeaderText = "التاريخ";
                    dgvKeys.Columns[1].HeaderText = "العميل / المتجر";
                    dgvKeys.Columns[2].HeaderText = "معرف الجهاز (Machine ID)";
                    dgvKeys.Columns[3].HeaderText = "مفتاح التفعيل (License Key)";
                    dgvKeys.Columns[4].HeaderText = "النوع";
                }

                lblDbC1Title.Text = "إنشاء قاعدة بيانات إنتاجية نظيفة للبيع والتوزيع (database_clean.sqlite)";
                lblDbC1Desc.Text = "تجهيز قاعدة بيانات خالية تماماً من فواتير ومنتجات الاختبار التجريبية، جاهزة للبيع للزبون مع الحساب الافتراضي (admin/smartpos).";
                btnCreateCleanDb.Text = "⚡ إنشاء وتحديث database_clean.sqlite";

                lblDbC2Title.Text = "تفريغ وإعادة ضبط القاعدة المحلية الحالية (database.sqlite)";
                lblDbC2Desc.Text = "حذف سجلات الاختبار والبدء من جديد. سيتم دائماً إنشاء نسخة احتياطية آمنة في مجلد /backups قبل أي عملية تفريغ.";
                btnCleanMainDb.Text = "⚠️ تفريغ وإعادة تعيين database.sqlite الحالية";

                lblDbC3Title.Text = "الوصول السريع إلى المجلدات والملفات الرئيسية :";
                btnOpenDbFolder.Text = "📁 مجلد البرنامج الرئيسي";
                btnOpenBackupFolder.Text = "📂 مجلد النسخ الاحتياطية (backups)";

                lblBTitle.Text = "تجميع وبناء مثبت الويندوز الشامل النهائي (Setup-SmartPOS.exe)";
                lblBDesc.Text = "يقوم ببناء الواجهة الأمامية، خادم Node.js، ودمج قاعدة البيانات النظيفة مع ملف التثبيت الموحد لتسليمه للزبون لتثبيته بضغطة زر واحدة.";
                chkCleanDbBeforeBuild.Text = "ضمان تجهيز قاعدة بيانات نظيفة database_clean.sqlite قبل التجميع";
                chkOpenFolderOnComplete.Text = "فتح مجلد Final-Release تلقائياً فور اكتمال البناء";
                btnStartBuild.Text = "⚡ بدء التجميع وبناء مثبت الويندوز النهائي";
                btnOpenReleaseFolder.Text = "📂 مجلد Final-Release";

                lblLogTitle.Text = "سجل العمليات والأحداث المباشر :";
                btnClearLog.Text = "مسح السجل";
                btnCopyLog.Text = "نسخ السجل";
                lblCurrentStatus.Text = "الحالة : جاهز • هاتف الدعم الفني المباشر : 0677212982";
            }
            else
            {
                this.Text = "SmartPOS Pro — Master Tool & Déploiement";
                btnLangToggle.Text = "🌐  العربية";

                lblSidebarTitle.Text = "SmartPOS Pro";
                lblSidebarSubtitle.Text = "Outils Développeur & Master";
                lblNavCategory.Text = "NAVIGATION";

                lblSupportTitleSidebar.Text = "Support & Ventes :";
                lblSupportContactSidebar.Text = "0677212982";
                lblSupportDescSidebar.Text = "Assistance & activation à vie";

                btnTabLicense.Text     = "Licences & Activation";
                btnTabKeysHistory.Text = "Historique des Clés";
                btnTabDatabase.Text    = "Base de Données";
                btnTabBuild.Text       = "Build & Setup";
                btnTabLogs.Text        = "Journal Système";

                lblMidHeader.Text = "Identifiant Machine du Client (Machine ID) :";
                lblMidHint.Text = "✦ Identifiant matériel unique (collez ici celui affiché sur l'écran du client).";
                lblCustHeader.Text = "Nom du Client ou Établissement Commercial (Optionnel) :";
                if (txtCustomerName.Text == "المحل التجاري") txtCustomerName.Text = "Magasin / Entreprise";
                btnPasteMachineId.Text = "📋 Coller";
                btnUseThisPcId.Text = "💻 Ce PC";
                btnGenKey.Text = "⚡ Générer la Clé Officielle d'Activation";
                btnCopyKey.Text = "📋 Copier la Clé";
                btnVerifyKey.Text = "🔍 Vérifier la Clé";
                btnActivateThisPc.Text = "🚀 Activer SmartPOS sur ce PC";
                btnCopyMsg.Text = "💬 Message WhatsApp Client";

                lblSupportTitle.Text = "Support Technique Officiel & Commandes de Licences :";
                lblSupportContact.Text = "Tél / WhatsApp : 0677212982";
                lblSupportDesc.Text = "Assistance technique & activation permanente garantie sans interruption.";

                lblHistoryCount.Text = string.Format("● Historique des Licences & Clés ({0} enregistrées) :", allHistoryItems.Count);
                btnCopyHistoryKey.Text = "📋 Copier la Clé";
                btnActivateSelectedHistory.Text = "🚀 Activer ce PC";
                btnDeleteHistory.Text = "🗑️ Supprimer";
                btnRefreshHistory.Text = "🔄 Actualiser";
                lblTableTip.Text = "💡 Double-clic sur une ligne pour copier la clé instantanément";

                if (dgvKeys != null && dgvKeys.Columns.Count >= 5)
                {
                    dgvKeys.Columns[0].HeaderText = "Date";
                    dgvKeys.Columns[1].HeaderText = "Client / Magasin";
                    dgvKeys.Columns[2].HeaderText = "Identifiant Machine";
                    dgvKeys.Columns[3].HeaderText = "Clé d'Activation";
                    dgvKeys.Columns[4].HeaderText = "Type";
                }

                lblDbC1Title.Text = "Créer la Base de Données Vierge Commerciale (database_clean.sqlite)";
                lblDbC1Desc.Text = "Génère une base prête pour la vente (admin/smartpos, sans ventes ni produits de test).";
                btnCreateCleanDb.Text = "⚡ Générer database_clean.sqlite";

                lblDbC2Title.Text = "Purger et Réinitialiser la Base Locale Actuelle (database.sqlite)";
                lblDbC2Desc.Text = "Une sauvegarde automatique horodatée est toujours créée dans /backups avant réinitialisation.";
                btnCleanMainDb.Text = "⚠️ Réinitialiser database.sqlite";

                lblDbC3Title.Text = "Accès Rapide aux Dossiers Clés :";
                btnOpenDbFolder.Text = "📁 Dossier du Projet";
                btnOpenBackupFolder.Text = "📂 Dossier Sauvegardes";

                lblBTitle.Text = "Compilation de l'Installateur Windows Autonome (Setup-SmartPOS.exe)";
                lblBDesc.Text = "Compile l'interface web, le serveur SQLite Node.js et package l'exécutable d'installation.";
                chkCleanDbBeforeBuild.Text = "Garantir une base propre database_clean.sqlite avant compilation";
                chkOpenFolderOnComplete.Text = "Ouvrir le dossier Final-Release automatiquement à la fin";
                btnStartBuild.Text = "⚡ Lancer la Compilation Finale";
                btnOpenReleaseFolder.Text = "📂 Dossier Final-Release";

                lblLogTitle.Text = "Journal des Opérations en Direct :";
                btnClearLog.Text = "Effacer";
                btnCopyLog.Text = "Copier le Journal";
                lblCurrentStatus.Text = "Statut : Prêt • Support Téléphone : 0677212982";
            }

            SwitchTab(currentTabIndex);
            RefreshStatusBadges();
        }

        // ====================================================================
        // DYNAMIC CONTENT HEADER
        // ====================================================================
        private void UpdateHeaderForTab(int tabIndex)
        {
            if (lblHeaderTitle == null || lblHeaderSubtitle == null) return;

            if (isArabic)
            {
                switch (tabIndex)
                {
                    case 0:
                        lblHeaderTitle.Text = "التراخيص وتفعيل الأجهزة";
                        lblHeaderSubtitle.Text = "توليد مفاتيح التفعيل الدائمة • ربط عتادي آمن (HMAC-SHA256) لحماية البرنامج";
                        break;
                    case 1:
                        lblHeaderTitle.Text = "سجل المفاتيح والتراخيص الصادرة";
                        lblHeaderSubtitle.Text = string.Format("متابعة التراخيص المعتمدة ({0} مسجلة) • بحث، نسخ فوري، وتفعيل مباشر بنقرة واحدة", allHistoryItems != null ? allHistoryItems.Count : 0);
                        break;
                    case 2:
                        lblHeaderTitle.Text = "إدارة وقاعدة البيانات";
                        lblHeaderSubtitle.Text = "تجهيز قاعدة بيانات نظيفة وجديدة للزبائن • تفريغ بيانات الاختبار • نسخ احتياطية مؤمنة";
                        break;
                    case 3:
                        lblHeaderTitle.Text = "بناء وتجميع حزمة التثبيت";
                        lblHeaderSubtitle.Text = "بناء حزمة التثبيت المستقلة الشاملة Setup-SmartPOS.exe بضغطة زر واحدة";
                        break;
                    case 4:
                        lblHeaderTitle.Text = "سجل العمليات والأحداث المباشر";
                        lblHeaderSubtitle.Text = "مراقبة أوامر النظام، مخرجات عمليات البناء، وسجلات التهيئة في الوقت الفعلي";
                        break;
                }
            }
            else
            {
                switch (tabIndex)
                {
                    case 0:
                        lblHeaderTitle.Text = "Gestion des Licences & Activation";
                        lblHeaderSubtitle.Text = "Génération de clés d'activation • Liaison matérielle sécurisée (HMAC-SHA256)";
                        break;
                    case 1:
                        lblHeaderTitle.Text = "Historique des Licences & Clés";
                        lblHeaderSubtitle.Text = string.Format("Suivi des licences ({0} enregistrées) • Recherche, copie rapide et réactivation", allHistoryItems != null ? allHistoryItems.Count : 0);
                        break;
                    case 2:
                        lblHeaderTitle.Text = "Base de Données & Maintenance";
                        lblHeaderSubtitle.Text = "Création base vierge pour distribution • Purge des données de test • Sauvegardes";
                        break;
                    case 3:
                        lblHeaderTitle.Text = "Compilation de l'Installateur";
                        lblHeaderSubtitle.Text = "Assemblage du package tout-en-un Setup-SmartPOS.exe prêt à distribuer";
                        break;
                    case 4:
                        lblHeaderTitle.Text = "Journal des Opérations";
                        lblHeaderSubtitle.Text = "Suivi en direct des logs système, exécution des scripts et statut des processus";
                        break;
                }
            }
        }

        // ====================================================================
        // TAB SWITCHER
        // ====================================================================
        private void SwitchTab(int tabIndex)
        {
            currentTabIndex = tabIndex;
            UpdateTabButtonStyle(btnTabLicense,     tabIndex == 0);
            UpdateTabButtonStyle(btnTabKeysHistory, tabIndex == 1);
            UpdateTabButtonStyle(btnTabDatabase,    tabIndex == 2);
            UpdateTabButtonStyle(btnTabBuild,       tabIndex == 3);
            UpdateTabButtonStyle(btnTabLogs,        tabIndex == 4);

            panelLicense.Visible     = (tabIndex == 0);
            panelKeysHistory.Visible = (tabIndex == 1);
            panelDatabase.Visible    = (tabIndex == 2);
            panelBuild.Visible       = (tabIndex == 3);
            panelLogs.Visible        = (tabIndex == 4);

            UpdateHeaderForTab(tabIndex);
        }

        private void UpdateTabButtonStyle(ModernButton btn, bool isActive)
        {
            if (btn == null) return;

            if (isActive)
            {
                // Active menu title: sleek Indigo pill with bold white text
                btn.Font = GetAppFont(9.25f, FontStyle.Bold);
                btn.ApplyTheme(
                    Color.FromArgb(79, 70, 229), Color.FromArgb(79, 70, 229),
                    Color.FromArgb(99, 102, 241), Color.FromArgb(99, 102, 241),
                    Color.FromArgb(67, 56, 202), Color.FromArgb(67, 56, 202),
                    Color.Transparent, Color.Transparent,
                    Color.White
                );
            }
            else
            {
                // Inactive: clean menu title, blends into sidebar with zero button borders/box
                btn.Font = GetAppFont(9f, FontStyle.Regular);
                btn.ApplyTheme(
                    SidebarBg, SidebarBg,
                    Color.FromArgb(24, 34, 53), Color.FromArgb(24, 34, 53),
                    SidebarBg, SidebarBg,
                    Color.Transparent, Color.Transparent,
                    Color.FromArgb(148, 163, 184)
                );
            }
        }

        private ModernButton CreateNavTabButton(string text, int y, int width)
        {
            ModernButton btn = new ModernButton();
            btn.Text = text;
            btn.Font = GetAppFont(9f, FontStyle.Regular);
            btn.Size = new Size(width, 36);
            btn.Location = new Point(12, y);
            btn.CornerRadius = 6;
            btn.Cursor = Cursors.Default;
            return btn;
        }

        public static GraphicsPath GetRoundedPath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            if (rect.Width <= 0 || rect.Height <= 0)
            {
                path.AddRectangle(new Rectangle(0, 0, 1, 1));
                return path;
            }
            if (radius <= 0)
            {
                path.AddRectangle(rect);
                return path;
            }
            int diameter = radius * 2;
            if (diameter > rect.Width) diameter = rect.Width;
            if (diameter > rect.Height) diameter = rect.Height;
            if (diameter <= 0)
            {
                path.AddRectangle(rect);
                return path;
            }
            path.AddArc(rect.X, rect.Y, diameter, diameter, 180, 90);
            path.AddArc(rect.Right - diameter, rect.Y, diameter, diameter, 270, 90);
            path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rect.X, rect.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        private void OpenFolder(string path)
        {
            try
            {
                Process.Start("explorer.exe", path);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Impossible d'ouvrir le dossier : " + ex.Message, "Attention", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        // ====================================================================
        // CORE LOGIC: LICENSE GENERATION & VERIFICATION & LOCAL ACTIVATION
        // ====================================================================
        private void DoGenerateLicense()
        {
            try
            {
                string rawId = txtMachineId.Text;
                if (string.IsNullOrEmpty(rawId) || string.IsNullOrEmpty(rawId.Trim()))
                {
                    MessageBox.Show(
                        isArabic ? "يرجى إدخال معرف جهاز العميل (Machine ID) أولاً!" : "Veuillez saisir l'identifiant machine (Machine ID) du client !",
                        isArabic ? "حقل مطلوب" : "Champ Requis",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    txtMachineId.Focus();
                    return;
                }

                string cleanId = rawId.Trim().ToUpperInvariant();
                string customer = string.IsNullOrEmpty(txtCustomerName.Text.Trim()) ? (isArabic ? "عميل تجاري" : "Établissement Commercial") : txtCustomerName.Text.Trim();
                string key = GenerateActivationKeyNative(cleanId, LicenseSalt);

                txtGeneratedKey.Text = key;

                // Format friendly WhatsApp delivery message
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("══════════════════════════════════════");
                sb.AppendLine("   🌟 SmartPOS Pro — ترخيص التفعيل الرسمي الدائم");
                sb.AppendLine("══════════════════════════════════════");
                sb.AppendLine();
                sb.AppendFormat("مرحباً بك عزيزي ({0})،\n", customer);
                sb.AppendLine("تم إصدار مفتاح التفعيل التجاري الدائم لبرنامج SmartPOS Pro بنجاح:");
                sb.AppendLine();
                sb.AppendFormat("🔑 مفتاح التفعيل : {0}\n", key);
                sb.AppendFormat("💻 معرف الجهاز    : {0}\n", cleanId);
                sb.AppendLine("🛡️ نوع الترخيص    : ترخيص تجاري دائم مدى الحياة (Licence Perpétuelle)");
                sb.AppendLine();
                sb.AppendLine("طريقة التفعيل بضغطة زر واحدة :");
                sb.AppendLine("1. افتح برنامج SmartPOS Pro على حاسوبك.");
                sb.AppendLine("2. الصق مفتاح التفعيل أعلاه في نافذة التفعيل واضغط [تأكيد التفعيل].");
                sb.AppendLine("3. سيعمل البرنامج فوراً وبشكل دائم ومستقر دون أي انقطاع.");
                sb.AppendLine();
                sb.AppendLine("📞 الدعم الفني المباشر : 0677212982  (+212 677 212 982)");
                sb.AppendLine("══════════════════════════════════════");
                txtCustomerMessage.Text = sb.ToString();

                // Save to history list
                var existing = allHistoryItems.Find(h => string.Equals(h.MachineId, cleanId, StringComparison.OrdinalIgnoreCase));
                if (existing != null)
                {
                    existing.Date = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
                    existing.Customer = customer;
                    existing.Key = key;
                }
                else
                {
                    allHistoryItems.Insert(0, new KeyHistoryItem
                    {
                        Date = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                        Customer = customer,
                        MachineId = cleanId,
                        Key = key,
                        LicenseType = "Commerciale Permanente (À vie)"
                    });
                }
                SaveKeysHistoryToFile();
                FilterKeysHistory();

                AppendLog(string.Format(isArabic ? "تم توليد مفتاح ترخيص بنجاح لـ [{0}]" : "Clé de licence générée avec succès pour [{0}]", customer));
                AppendLog(string.Format("   - Machine ID : {0}", cleanId));
                AppendLog(string.Format("   - Key        : {0}", key));
                lblCurrentStatus.Text = isArabic ? "الحالة : تم توليد المفتاح وحفظه في السجل بنجاح ✓" : "Statut : Clé générée et enregistrée dans l'historique ✓";
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erreur : " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void DoVerifyLicense()
        {
            string rawId = txtMachineId.Text;
            if (string.IsNullOrEmpty(rawId) || string.IsNullOrEmpty(rawId.Trim()))
            {
                MessageBox.Show(
                    isArabic ? "يرجى إدخال معرف الجهاز (Machine ID) أولاً لاختبار المفتاح عليه." : "Veuillez d'abord saisir l'Identifiant Machine pour tester la clé.",
                    isArabic ? "تنبيه" : "Attention",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                txtMachineId.Focus();
                return;
            }

            string testKey = txtGeneratedKey.Text;
            if (string.IsNullOrEmpty(testKey) || string.IsNullOrEmpty(testKey.Trim()) || testKey == "ACTV-XXXX-XXXX-XXXX")
            {
                MessageBox.Show(
                    isArabic ? "يرجى توليد مفتاح أو كتابته في حقل المفتاح لاختباره." : "Veuillez saisir ou générer une clé dans le champ pour la tester.",
                    isArabic ? "تنبيه" : "Attention",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            string cleanId = rawId.Trim().ToUpperInvariant();
            string expected = GenerateActivationKeyNative(cleanId, LicenseSalt);
            string cleanTestKey = testKey.Trim().ToUpperInvariant().Replace(" ", "");
            bool isValid = string.Equals(expected, cleanTestKey, StringComparison.OrdinalIgnoreCase);

            if (isValid)
            {
                MessageBox.Show(
                    isArabic 
                        ? "✅ المفتاح صحيح ومتطابق 100% مع معرف هذا الجهاز!\n\n• المفتاح: " + testKey + "\n• الجهاز: " + cleanId
                        : "Clé valide ! Elle correspond exactement à cet Identifiant Machine.\n\nClé : " + testKey,
                    isArabic ? "فحص ناجح ✓" : "Vérification Réussie",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                AppendLog(string.Format("Vérification : Clé [{0}] VALIDE pour [{1}]", testKey, cleanId));
            }
            else
            {
                MessageBox.Show(
                    isArabic 
                        ? "❌ المفتاح غير متطابق مع هذا الجهاز!\n\nالمفتاح الصحيح لهذا الجهاز هو:\n" + expected
                        : "Clé invalide pour cette machine !\nLa clé correcte est : " + expected,
                    isArabic ? "مفتاح غير متطابق" : "Clé Incompatible",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                AppendLog(string.Format("Vérification : Clé [{0}] INVALIDE pour [{1}]", testKey, cleanId));
            }
        }

        // ====================================================================
        // DIRECT LOCAL MACHINE ACTIVATION
        // ====================================================================
        private void DoActivateLocalMachine(string customMachineId = null, string customKey = null, string customer = null)
        {
            try
            {
                string thisPcMid = GetLocalMachineIdNative();
                string targetMid = !string.IsNullOrEmpty(customMachineId) ? customMachineId.Trim().ToUpperInvariant() : thisPcMid;

                // Safety guard: Is the user trying to activate this PC using a foreign machine's key from history?
                if (!string.Equals(targetMid, thisPcMid, StringComparison.OrdinalIgnoreCase))
                {
                    DialogResult dr = MessageBox.Show(
                        isArabic
                            ? "⚠️ تنبيه هام:\nهذا المفتاح تم توليده لجهاز آخر (" + targetMid + ") وليس لهذا الحاسوب (" + thisPcMid + ").\n\nهل تريد تفعيل هذا الحاسوب بمفتاحه الصحيح الخاص به؟"
                            : "⚠️ Attention :\nCette clé a été générée pour un autre PC (" + targetMid + ").\nVoulez-vous activer CE PC avec sa propre clé valide ?",
                        isArabic ? "تأكيد التفعيل" : "Confirmation d'activation",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question);

                    if (dr != DialogResult.Yes) return;
                    targetMid = thisPcMid;
                    customKey = null;
                }

                string cust = !string.IsNullOrEmpty(customer) ? customer.Trim() : (!string.IsNullOrEmpty(txtCustomerName.Text.Trim()) ? txtCustomerName.Text.Trim() : "SmartPOS Enterprise (Ce PC)");
                string key = !string.IsNullOrEmpty(customKey) ? customKey.Trim().ToUpperInvariant() : GenerateActivationKeyNative(targetMid, LicenseSalt);

                txtMachineId.Text = targetMid;
                txtGeneratedKey.Text = key;

                // 1. Direct SQLite database activation (via temporary node script to avoid Windows quote escaping bugs)
                ApplyLicenseDirectToDatabases(targetMid, key, cust);

                // 2. HTTP API activation if server is currently running (with strict timeout)
                bool apiSuccess = false;
                try
                {
                    HttpWebRequest apiReq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/api/license/activate");
                    apiReq.Timeout = 1000;
                    apiReq.Method = "POST";
                    apiReq.ContentType = "application/json";
                    byte[] payloadBytes = Encoding.UTF8.GetBytes(string.Format("{{\"key\":\"{0}\",\"customerName\":\"{1}\"}}", key, cust));
                    apiReq.ContentLength = payloadBytes.Length;
                    using (Stream s = apiReq.GetRequestStream())
                    {
                        s.Write(payloadBytes, 0, payloadBytes.Length);
                    }
                    using (HttpWebResponse res = (HttpWebResponse)apiReq.GetResponse())
                    {
                        if (res.StatusCode == HttpStatusCode.OK) apiSuccess = true;
                    }
                }
                catch { }

                if (apiSuccess)
                {
                    AppendLog("Serveur SmartPOS en ligne : activé en direct via API.");
                }

                // 3. Save to history
                var existing = allHistoryItems.Find(h => string.Equals(h.MachineId, targetMid, StringComparison.OrdinalIgnoreCase));
                if (existing != null)
                {
                    existing.Date = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
                    existing.Customer = cust;
                    existing.Key = key;
                }
                else
                {
                    allHistoryItems.Insert(0, new KeyHistoryItem
                    {
                        Date = DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
                        Customer = cust,
                        MachineId = targetMid,
                        Key = key,
                        LicenseType = "Commerciale Permanente (À vie)"
                    });
                }
                SaveKeysHistoryToFile();
                FilterKeysHistory();

                MessageBox.Show(
                    isArabic
                        ? "✅ تم تفعيل البرنامج بنجاح بترخيص تجاري دائم مدى الحياة!\n\n" +
                          "• معرف هذا الجهاز (Machine ID) : " + targetMid + "\n" +
                          "• مفتاح التفعيل الدائم         : " + key + "\n" +
                          "• المرخص له                  : " + cust + "\n\n" +
                          "البرنامج مرخص بالكامل الآن ولن تظهر الفترة التجريبية إطلاقاً."
                        : "✅ SmartPOS a été activé avec succès en Licence Permanente !\n\n" +
                          "• Machine ID : " + targetMid + "\n" +
                          "• Clé        : " + key + "\n" +
                          "• Client     : " + cust + "\n\n" +
                          "Licence commerciale active sans aucune limite.",
                    isArabic ? "تم التفعيل بنجاح ✓" : "Activation Réussie ✓",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);

                AppendLog("Activation permanente réussie pour ce PC :");
                AppendLog("   - Machine ID : " + targetMid);
                AppendLog("   - Clé        : " + key);
                lblCurrentStatus.Text = isArabic ? "الحالة : تم تفعيل الترخيص الدائم على هذا الحاسوب بنجاح ✓" : "Statut : Licence permanente activée avec succès ✓";
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erreur lors de l'activation : " + ex.Message, "Erreur", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ApplyLicenseDirectToDatabases(string machineId, string key, string customerName)
        {
            try
            {
                string[] targetDbs = new string[] {
                    Path.Combine(Application.StartupPath, "database.sqlite"),
                    @"C:\SmartPOS\database.sqlite"
                };

                string nodeExe = "node";
                string[] nodeCandidates = new string[] {
                    Path.Combine(Application.StartupPath, "runtime", "node.exe"),
                    @"C:\SmartPOS\runtime\node.exe",
                    @"C:\Program Files\nodejs\node.exe"
                };
                foreach (string nc in nodeCandidates)
                {
                    if (File.Exists(nc)) { nodeExe = nc; break; }
                }

                string tempScriptPath = Path.Combine(Path.GetTempPath(), "smartpos_apply_license_" + Guid.NewGuid().ToString("N") + ".cjs");

                StringBuilder sbDbs = new StringBuilder();
                foreach (string db in targetDbs)
                {
                    if (File.Exists(db))
                    {
                        if (sbDbs.Length > 0) sbDbs.Append(", ");
                        sbDbs.Append("\"" + db.Replace("\\", "/") + "\"");
                    }
                }

                if (sbDbs.Length == 0) return;

                string scriptContent = string.Format(
                    "const fs = require('fs');\n" +
                    "const {{ DatabaseSync }} = require('node:sqlite');\n" +
                    "const dbs = [{0}];\n" +
                    "for (const dbPath of dbs) {{\n" +
                    "  try {{\n" +
                    "    const db = new DatabaseSync(dbPath);\n" +
                    "    db.exec('CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)');\n" +
                    "    const rec = {{\n" +
                    "      isActivated: true,\n" +
                    "      activationKey: '{1}',\n" +
                    "      activatedAt: new Date().toISOString(),\n" +
                    "      machineId: '{2}',\n" +
                    "      firstLaunchDate: new Date().toISOString(),\n" +
                    "      customerName: '{3}'\n" +
                    "    }};\n" +
                    "    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('license_info', JSON.stringify(rec));\n" +
                    "    console.log('OK:' + dbPath);\n" +
                    "  }} catch(e) {{ console.error('ERR:' + e.message); }}\n" +
                    "}}\n",
                    sbDbs.ToString(), key, machineId, customerName.Replace("'", "\\'").Replace("\"", "\\\""));

                File.WriteAllText(tempScriptPath, scriptContent, Encoding.UTF8);

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "\"" + tempScriptPath + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(4000);

                try { File.Delete(tempScriptPath); } catch { }
            }
            catch (Exception ex)
            {
                AppendLog("Direct DB update warning: " + ex.Message);
            }
        }

        public static string GetLocalMachineIdNative()
        {
            // 1. Try reading directly from active SmartPOS server (fast 400ms timeout)
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/api/license/status");
                req.Timeout = 400;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    if (res.StatusCode == HttpStatusCode.OK)
                    {
                        using (StreamReader sr = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                        {
                            string json = sr.ReadToEnd();
                            string extracted = ExtractJsonField(json, "machineId");
                            if (!string.IsNullOrEmpty(extracted) && extracted.StartsWith("SPOS-")) return extracted;
                        }
                    }
                }
            }
            catch { }

            // 2. Hardware fingerprint matching Node.js os module
            try
            {
                string macAddress = "";
                NetworkInterface[] nics = NetworkInterface.GetAllNetworkInterfaces();
                Array.Sort(nics, delegate(NetworkInterface a, NetworkInterface b) { return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase); });

                foreach (NetworkInterface adapter in nics)
                {
                    if (adapter.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        adapter.OperationalStatus == OperationalStatus.Up)
                    {
                        string mac = adapter.GetPhysicalAddress().ToString();
                        if (!string.IsNullOrEmpty(mac) && mac != "000000000000")
                        {
                            List<string> parts = new List<string>();
                            for (int i = 0; i < mac.Length; i += 2)
                            {
                                if (i + 2 <= mac.Length) parts.Add(mac.Substring(i, 2).ToLowerInvariant());
                            }
                            macAddress = string.Join(":", parts.ToArray());
                            break;
                        }
                    }
                }

                string cpuModel = "GenericCPU";
                try
                {
                    object regVal = Microsoft.Win32.Registry.GetValue(
                        @"HKEY_LOCAL_MACHINE\HARDWARE\DESCRIPTION\System\CentralProcessor\0",
                        "ProcessorNameString",
                        "GenericCPU");
                    if (regVal != null) cpuModel = regVal.ToString().Trim();
                }
                catch { }

                string rawFingerprint = string.Format("{0}_{1}_{2}_{3}_{4}",
                    Environment.MachineName,
                    "win32",
                    Environment.Is64BitOperatingSystem ? "x64" : "ia32",
                    cpuModel,
                    macAddress);

                using (SHA256 sha = SHA256.Create())
                {
                    byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(rawFingerprint));
                    string hex = BitConverter.ToString(hash).Replace("-", "").ToUpperInvariant();
                    return string.Format("SPOS-{0}-{1}-{2}", hex.Substring(0, 4), hex.Substring(4, 4), hex.Substring(8, 4));
                }
            }
            catch
            {
                return "SPOS-COMM-2026-UNQ1";
            }
        }

        public static string GenerateActivationKeyNative(string machineId, string salt)
        {
            using (HMACSHA256 hmac = new HMACSHA256(Encoding.UTF8.GetBytes(salt)))
            {
                byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(machineId.Trim().ToUpperInvariant()));
                string hex = BitConverter.ToString(hash).Replace("-", "").ToUpperInvariant();
                return string.Format("ACTV-{0}-{1}-{2}", hex.Substring(0, 4), hex.Substring(4, 4), hex.Substring(8, 4));
            }
        }

        // ====================================================================
        // JSON HELPER FOR ROBUST PARSING
        // ====================================================================
        private static List<KeyHistoryItem> ParseKeysJson(string json)
        {
            List<KeyHistoryItem> list = new List<KeyHistoryItem>();
            if (string.IsNullOrEmpty(json)) return list;

            int cur = 0;
            while (cur < json.Length)
            {
                int objStart = json.IndexOf('{', cur);
                if (objStart == -1) break;
                int objEnd = json.IndexOf('}', objStart);
                if (objEnd == -1) break;

                string block = json.Substring(objStart, objEnd - objStart + 1);
                KeyHistoryItem item = new KeyHistoryItem();
                item.Date = ExtractJsonField(block, "date");
                item.Customer = ExtractJsonField(block, "customer");
                item.MachineId = ExtractJsonField(block, "machineId");
                item.Key = ExtractJsonField(block, "key");
                item.LicenseType = ExtractJsonField(block, "licenseType");
                if (string.IsNullOrEmpty(item.LicenseType)) item.LicenseType = "Commerciale Permanente (À vie)";

                if (!string.IsNullOrEmpty(item.Key)) list.Add(item);
                cur = objEnd + 1;
            }
            return list;
        }

        private static string ExtractJsonField(string block, string key)
        {
            string search = "\"" + key + "\":";
            int idx = block.IndexOf(search, StringComparison.OrdinalIgnoreCase);
            if (idx == -1) return "";
            int start = idx + search.Length;
            while (start < block.Length && (block[start] == ' ' || block[start] == '"')) start++;
            int end = start;
            while (end < block.Length && block[end] != '"' && block[end] != ',' && block[end] != '}') end++;
            if (end > start) return block.Substring(start, end - start).Trim();
            return "";
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }
    }
}
