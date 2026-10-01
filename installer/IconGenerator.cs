using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;

public class IconGenerator
{
    public static Bitmap RenderSPBitmap(int size)
    {
        // Render at 512x512 first for supersampled anti-aliasing, then scale down
        int canvasSize = 512;
        using (Bitmap master = new Bitmap(canvasSize, canvasSize, PixelFormat.Format32bppArgb))
        using (Graphics g = Graphics.FromImage(master))
        {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            // 1. Rounded Squircle Background
            Rectangle rect = new Rectangle(24, 24, 464, 464);
            using (GraphicsPath bgPath = CreateRoundedRect(rect, 112))
            {
                using (LinearGradientBrush bgBrush = new LinearGradientBrush(
                    rect,
                    Color.FromArgb(255, 79, 70, 229),   // Indigo 600
                    Color.FromArgb(255, 15, 23, 42),    // Slate 900
                    LinearGradientMode.ForwardDiagonal))
                {
                    ColorBlend cb = new ColorBlend();
                    cb.Positions = new float[] { 0.0f, 0.52f, 1.0f };
                    cb.Colors = new Color[] {
                        Color.FromArgb(255, 99, 102, 241),
                        Color.FromArgb(255, 55, 48, 163),
                        Color.FromArgb(255, 15, 23, 42)
                    };
                    bgBrush.InterpolationColors = cb;
                    g.FillPath(bgBrush, bgPath);
                }

                // Subtle top-left gloss highlight
                using (GraphicsPath glossPath = new GraphicsPath())
                {
                    glossPath.AddEllipse(-60, -90, 480, 320);
                    g.SetClip(bgPath);
                    using (SolidBrush glossBrush = new SolidBrush(Color.FromArgb(28, 255, 255, 255)))
                    {
                        g.FillPath(glossBrush, glossPath);
                    }
                    g.ResetClip();
                }

                // Glowing Outer Border
                using (Pen borderPen = new Pen(Color.FromArgb(210, 129, 140, 248), 10f))
                {
                    g.DrawPath(borderPen, bgPath);
                }
            }

            // Inner subtle frame
            Rectangle innerRect = new Rectangle(42, 42, 428, 428);
            using (GraphicsPath innerPath = CreateRoundedRect(innerRect, 94))
            using (Pen innerPen = new Pen(Color.FromArgb(35, 255, 255, 255), 3f))
            {
                g.DrawPath(innerPen, innerPath);
            }

            // 2. Draw Merged "SP" Monogram
            // We create two paths for 'S' and 'P' positioned so they interlock & merge seamlessly
            using (FontFamily ff = new FontFamily("Arial"))
            {
                // Drop shadow for the merged SP
                using (GraphicsPath shadowPath = new GraphicsPath())
                {
                    shadowPath.AddString("S", ff, (int)FontStyle.Bold, 315f, new PointF(64f, 84f), StringFormat.GenericTypographic);
                    shadowPath.AddString("P", ff, (int)FontStyle.Bold, 315f, new PointF(218f, 114f), StringFormat.GenericTypographic);
                    using (Matrix m = new Matrix())
                    {
                        m.Translate(0, 12);
                        shadowPath.Transform(m);
                    }
                    using (SolidBrush shadowBrush = new SolidBrush(Color.FromArgb(115, 0, 0, 0)))
                    {
                        g.FillPath(shadowBrush, shadowPath);
                    }
                }

                // Letter 'P' (Cyan/Sky-Blue gradient, merged on the right & interlocking with S)
                using (GraphicsPath pPath = new GraphicsPath())
                {
                    pPath.AddString("P", ff, (int)FontStyle.Bold, 315f, new PointF(218f, 114f), StringFormat.GenericTypographic);
                    using (LinearGradientBrush pBrush = new LinearGradientBrush(
                        new Rectangle(200, 100, 260, 320),
                        Color.FromArgb(255, 56, 189, 248),  // Sky 400
                        Color.FromArgb(255, 129, 140, 248), // Indigo 400
                        LinearGradientMode.Vertical))
                    {
                        g.FillPath(pBrush, pPath);
                    }
                    using (Pen pOutline = new Pen(Color.FromArgb(140, 255, 255, 255), 3f))
                    {
                        pOutline.LineJoin = LineJoin.Round;
                        g.DrawPath(pOutline, pPath);
                    }
                }

                // Letter 'S' (Crisp White-to-Ice gradient, overlapping & fused with P's vertical spine)
                using (GraphicsPath sPath = new GraphicsPath())
                {
                    sPath.AddString("S", ff, (int)FontStyle.Bold, 315f, new PointF(64f, 84f), StringFormat.GenericTypographic);

                    // Subtle dark separation aura right where S overlaps P for depth while keeping them fused
                    using (Pen sepPen = new Pen(Color.FromArgb(90, 15, 23, 42), 12f))
                    {
                        sepPen.LineJoin = LineJoin.Round;
                        g.DrawPath(sepPen, sPath);
                    }

                    using (LinearGradientBrush sBrush = new LinearGradientBrush(
                        new Rectangle(60, 70, 250, 320),
                        Color.FromArgb(255, 255, 255, 255),
                        Color.FromArgb(255, 224, 231, 255),
                        LinearGradientMode.Vertical))
                    {
                        g.FillPath(sBrush, sPath);
                    }
                }
            }

            // Scale down to target size
            Bitmap result = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics rg = Graphics.FromImage(result))
            {
                rg.SmoothingMode = SmoothingMode.HighQuality;
                rg.InterpolationMode = InterpolationMode.HighQualityBicubic;
                rg.PixelOffsetMode = PixelOffsetMode.HighQuality;
                rg.Clear(Color.Transparent);
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
            using (Bitmap bmp = RenderSPBitmap(sizes[i]))
            using (MemoryStream ms = new MemoryStream())
            {
                bmp.Save(ms, ImageFormat.Png);
                pngBuffers[i] = ms.ToArray();
            }
        }

        using (FileStream fs = new FileStream(icoPath, FileMode.Create, FileAccess.Write))
        using (BinaryWriter bw = new BinaryWriter(fs))
        {
            // ICONDIR header
            bw.Write((ushort)0); // Reserved
            bw.Write((ushort)1); // Type 1 = ICO
            bw.Write((ushort)sizes.Length); // Count

            int offset = 6 + (16 * sizes.Length);
            for (int i = 0; i < sizes.Length; i++)
            {
                int s = sizes[i];
                bw.Write((byte)(s >= 256 ? 0 : s)); // Width
                bw.Write((byte)(s >= 256 ? 0 : s)); // Height
                bw.Write((byte)0); // Color count
                bw.Write((byte)0); // Reserved
                bw.Write((ushort)1); // Planes
                bw.Write((ushort)32); // Bits per pixel
                bw.Write((uint)pngBuffers[i].Length); // Size of image data
                bw.Write((uint)offset); // Offset
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
        SaveMultiSizeIcon(@"public\favicon.ico", sizes);
        using (Bitmap preview = RenderSPBitmap(256))
        {
            preview.Save(@"public\sp-icon.png", ImageFormat.Png);
        }
        Console.WriteLine("Icons generated successfully!");
    }
}
