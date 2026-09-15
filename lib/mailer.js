import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_SERVER_PORT || 587,
  secure: false, // true untuk port 465, false untuk port lainnya
  auth: {
    user: process.env.EMAIL_SERVER_USER, // Email pengirim (misal: admin@perusahaan.com)
    pass: process.env.EMAIL_SERVER_PASSWORD, // App Password dari email pengirim
  },
});

export async function sendAccountNotification(email, nama, username, plainPassword, unitKerja) {
  try {
    const mailOptions = {
      from: `"HRD PT Traya Langgeng Mandiri" <${process.env.EMAIL_SERVER_USER}>`,
      to: email,
      subject: `Informasi Akun & Registrasi Berhasil - ${unitKerja}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #2563eb;">Halo, ${nama}</h2>
          <p>Akun Anda untuk posisi <b>${unitKerja}</b> di PT Traya Langgeng Mandiri telah berhasil didaftarkan oleh Super Admin.</p>
          
          <p>Berikut adalah detail kredensial login Anda:</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 5px 0;"><strong>Password Sementara:</strong> ${plainPassword}</p>
          </div>

          <p>Silakan gunakan kredensial di atas untuk masuk ke dalam aplikasi sistem perusahaan.</p>
          <p><em>Catatan: Jaga kerahasiaan informasi akun Anda.</em></p>
          
          <br/>
          <p>Salam hormat,</p>
          <p><strong>Tim HRD / Super Admin</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Gagal mengirim email:', error);
    return { success: false, error: error.message };
  }
}