using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public class IconGenerator
{
    private static string SourceImagePath = @"C:\Users\Houcine\.gemini\antigravity\brain\878069ee-1c54-4308-8384-155d63b68452\.user_uploaded\media_1791284952983.jpg";

    private static Rectangle GetLogoBoundingBox(Bitmap bmp)
    {
        int minX = bmp.Width, minY = bmp.Height, maxX = 0, maxY = 0;
        bool found = false;
        for (int y = 0; y < bmp.Height; y++)
        {
            for (int x = 0; x < bmp.Width; x++)
            {
                Color c = bmp.GetPixel(x, y);
                // Detect any pixel that is not near-pure white
                if (c.A > 20 && (c.R < 244 || c.G < 244 || c.B < 244))
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }
        if (!found || maxX <= minX || maxY <= minY)
        {
            return new Rectangle(0, 0, bmp.Width, bmp.Height);
        }
        return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    public static Bitmap RenderLuxuryBitmap(int size, bool fullBleedForIOS = false)
    {
        int canvasSize = 1024;
        PixelFormat fmt = fullBleedForIOS ? PixelFormat.Format24bppRgb : PixelFormat.Format32bppArgb;
        using (Bitmap master = new Bitmap(canvasSize, canvasSize, fmt))
        using (Graphics g = Graphics.FromImage(master))
        {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.Clear(fullBleedForIOS ? Color.White : Color.Transparent);

            if (File.Exists(SourceImagePath))
            {
                using (Bitmap srcBmp = new Bitmap(SourceImagePath))
                {
                    Rectangle cropBox = GetLogoBoundingBox(srcBmp);

                    // Calculate destination rectangle that preserves aspect ratio and fills ~93% of the icon
                    double targetMaxDim = fullBleedForIOS ? (canvasSize * 0.92) : (canvasSize * 0.93);
                    double scale = Math.Min(targetMaxDim / cropBox.Width, targetMaxDim / cropBox.Height);
                    int destW = (int)Math.Round(cropBox.Width * scale);
                    int destH = (int)Math.Round(cropBox.Height * scale);
                    int destX = (canvasSize - destW) / 2;
                    int destY = (canvasSize - destH) / 2;
                    Rectangle destRect = new Rectangle(destX, destY, destW, destH);

                    if (fullBleedForIOS)
                    {
                        g.DrawImage(srcBmp, destRect, cropBox, GraphicsUnit.Pixel);
                    }
                    else
                    {
                        // Full-size rounded squircle mask for Windows Desktop & Web icon (minimal outer margin)
                        Rectangle bounds = new Rectangle(4, 4, canvasSize - 8, canvasSize - 8);
                        using (GraphicsPath clipPath = CreateRoundedRect(bounds, 220))
                        {
                            using (SolidBrush whiteBrush = new SolidBrush(Color.White))
                            {
                                g.FillPath(whiteBrush, clipPath);
                            }
                            g.SetClip(clipPath);
                            g.DrawImage(srcBmp, destRect, cropBox, GraphicsUnit.Pixel);
                            g.ResetClip();

                            // Crisp purple-gold border rim
                            using (Pen borderPen = new Pen(Color.FromArgb(240, 124, 58, 237), 12f))
                            {
                                g.DrawPath(borderPen, clipPath);
                            }
                        }
                    }
                }
            }

            Bitmap result = new Bitmap(size, size, fmt);
            using (Graphics rg = Graphics.FromImage(result))
            {
                rg.SmoothingMode = SmoothingMode.HighQuality;
                rg.InterpolationMode = InterpolationMode.HighQualityBicubic;
                rg.PixelOffsetMode = PixelOffsetMode.HighQuality;
                rg.CompositingQuality = CompositingQuality.HighQuality;
                rg.Clear(fullBleedForIOS ? Color.White : Color.Transparent);
                rg.DrawImage(master, new Rectangle(0, 0, size, size));
            }
            return result;
        }
    }

    private static GraphicsPath CreateRoundedRect(Rectangle bounds, int radius)
    {
        int diameter = radius * 2;
        Size size = new Size(diameter, diameter);
        Rectangle arc = new Rectangle(bounds.Location, size);
        GraphicsPath path = new GraphicsPath();

        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();
        return path;
    }

    public static void SaveMultiSizeIcon(string icoPath, int[] sizes)
    {
        byte[][] pngBuffers = new byte[sizes.Length][];
        for (int i = 0; i < sizes.Length; i++)
        {
            using (Bitmap bmp = RenderLuxuryBitmap(sizes[i], false))
            using (MemoryStream ms = new MemoryStream())
            {
                bmp.Save(ms, ImageFormat.Png);
                pngBuffers[i] = ms.ToArray();
            }
        }

        using (FileStream fs = new FileStream(icoPath, FileMode.Create, FileAccess.Write))
        using (BinaryWriter bw = new BinaryWriter(fs))
        {
            bw.Write((ushort)0);
            bw.Write((ushort)1);
            bw.Write((ushort)sizes.Length);

            int offset = 6 + (16 * sizes.Length);
            for (int i = 0; i < sizes.Length; i++)
            {
                int s = sizes[i];
                bw.Write((byte)(s >= 256 ? 0 : s));
                bw.Write((byte)(s >= 256 ? 0 : s));
                bw.Write((byte)0);
                bw.Write((byte)0);
                bw.Write((ushort)1);
                bw.Write((ushort)32);
                bw.Write((uint)pngBuffers[i].Length);
                bw.Write((uint)offset);
                offset += pngBuffers[i].Length;
            }

            for (int i = 0; i < sizes.Length; i++)
            {
                bw.Write(pngBuffers[i]);
            }
        }
    }

    public static void Main(string[] args)
    {
        int[] sizes = new int[] { 256, 128, 64, 48, 32, 16 };
        SaveMultiSizeIcon(@"installer\SmartPOS.ico", sizes);
        SaveMultiSizeIcon(@"SmartPOS.ico", sizes);
        SaveMultiSizeIcon(@"Final-Release\SmartPOS.ico", sizes);
        SaveMultiSizeIcon(@"Final-Release\SmartPOS-Portable\SmartPOS.ico", sizes);
        SaveMultiSizeIcon(@"public\favicon.ico", sizes);

        using (Bitmap preview = RenderLuxuryBitmap(512, false))
        {
            preview.Save(@"public\sp-icon.png", ImageFormat.Png);
        }

        string iosIconSetDir = @"ios\App\App\Assets.xcassets\AppIcon.appiconset";
        if (Directory.Exists(iosIconSetDir))
        {
            foreach (string file in Directory.GetFiles(iosIconSetDir, "*.png"))
            {
                int targetW = 1024;
                try
                {
                    using (Bitmap existing = new Bitmap(file))
                    {
                        targetW = existing.Width;
                    }
                }
                catch { }
                using (Bitmap iosBmp = RenderLuxuryBitmap(targetW, true))
                {
                    iosBmp.Save(file, ImageFormat.Png);
                }
            }
        }

        Console.WriteLine("Luxury Icons generated successfully!");
    }
}
