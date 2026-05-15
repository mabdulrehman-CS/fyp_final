import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional


def send_invitation_email(
    recipient_email: str,
    recipient_name: str,
    invitation_link: str,
) -> bool:
    """
    Send invitation email to candidate.
    Returns True if sent successfully, False otherwise.
    """
    try:
        # Email configuration from environment variables
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("NODEMAILER_EMAIL", "intraviewwai@gmail.com")
        sender_password = os.getenv("NODEMAILER_PASSWORD", "").replace(" ", "")

        if not sender_password:
            print("Warning: NODEMAILER_PASSWORD not set, email sending will fail")
            return False

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "You're Invited to Join IntraView AI"
        msg["From"] = sender_email
        msg["To"] = recipient_email

        # Create HTML email template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>IntraView AI Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">IntraView AI</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">AI-Powered Interview Simulator</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">Hello {recipient_name}!</h2>
                
                <p style="color: #64748b; font-size: 16px; margin-bottom: 20px;">
                    You've been invited to join <strong>IntraView AI</strong>, an advanced platform designed to help you practice and excel in technical interviews.
                </p>
                
                <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
                    <p style="color: #1e293b; margin: 0; font-size: 16px;">
                        <strong>What you'll get:</strong>
                    </p>
                    <ul style="color: #64748b; margin: 10px 0 0 0; padding-left: 20px;">
                        <li>Practice coding interviews with real-world problems</li>
                        <li>Get instant feedback on your solutions</li>
                        <li>Improve your interview skills with AI-powered analysis</li>
                        <li>Track your progress over time</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{invitation_link}" 
                       style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                        Get Started Now
                    </a>
                </div>
                
                <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    Or copy and paste this link into your browser:<br>
                    <a href="{invitation_link}" style="color: #2563eb; word-break: break-all;">{invitation_link}</a>
                </p>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                    This invitation was sent by an administrator. If you didn't expect this email, you can safely ignore it.
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2024 IntraView AI. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """

        # Create plain text version
        text_content = f"""
        Hello {recipient_name}!

        You've been invited to join IntraView AI, an advanced platform designed to help you practice and excel in technical interviews.

        What you'll get:
        - Practice coding interviews with real-world problems
        - Get instant feedback on your solutions
        - Improve your interview skills with AI-powered analysis
        - Track your progress over time

        Get started by clicking this link:
        {invitation_link}

        This invitation was sent by an administrator. If you didn't expect this email, you can safely ignore it.

        © 2024 IntraView AI. All rights reserved.
        """

        # Attach both versions
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)

        print(f"Invitation email sent successfully to {recipient_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Authentication Error: {e}")
        print(f"Please check NODEMAILER_EMAIL and NODEMAILER_PASSWORD environment variables")
        return False
    except smtplib.SMTPException as e:
        print(f"SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending invitation email: {type(e).__name__}: {e}")
        return False


def send_password_reset_otp_email(recipient_email: str, otp: str) -> bool:
    """
    Send password reset OTP email to user.
    Returns True if sent successfully, False otherwise.
    """
    try:
        # Email configuration from environment variables
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("NODEMAILER_EMAIL", "intraviewwai@gmail.com")
        sender_password = os.getenv("NODEMAILER_PASSWORD", "").replace(" ", "")

        if not sender_password:
            print("Warning: NODEMAILER_PASSWORD not set, email sending will fail")
            return False

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "IntraView AI - Password Reset OTP"
        msg["From"] = sender_email
        msg["To"] = recipient_email

        # Create HTML email template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">IntraView AI</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Password Reset</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 24px;">Password Reset Request</h2>
                
                <p style="color: #64748b; font-size: 16px; margin-bottom: 20px;">
                    You requested to reset your password. Use the OTP below to verify your identity and reset your password.
                </p>
                
                <div style="background-color: #f0f9ff; border: 2px solid #2563eb; border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                    <p style="color: #1e293b; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Your One-Time Password (OTP):</p>
                    <div style="font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace;">
                        {otp}
                    </div>
                </div>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    This OTP is valid for <strong>5 minutes</strong> only. Please do not share this code with anyone.
                </p>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2024 IntraView AI. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """

        # Create plain text version
        text_content = f"""
        Password Reset Request
        
        You requested to reset your password for IntraView AI.
        
        Your One-Time Password (OTP) is: {otp}
        
        This OTP is valid for 5 minutes only. Please do not share this code with anyone.
        
        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        
        © 2024 IntraView AI. All rights reserved.
        """

        # Attach both versions
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)

        print(f"Password reset OTP email sent successfully to {recipient_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Authentication Error: {e}")
        print(f"Please check NODEMAILER_EMAIL and NODEMAILER_PASSWORD environment variables")
        return False
    except smtplib.SMTPException as e:
        print(f"SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending password reset OTP email: {type(e).__name__}: {e}")
        return False



def send_signup_otp_email(recipient_email: str, otp: str, name: str = "") -> bool:
    """
    Send signup email verification OTP.
    Returns True if sent successfully, False otherwise.
    """
    try:
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("NODEMAILER_EMAIL", "intraviewwai@gmail.com")
        sender_password = os.getenv("NODEMAILER_PASSWORD", "").replace(" ", "")

        if not sender_password:
            print("Warning: NODEMAILER_PASSWORD not set, email sending will fail")
            return False

        greeting_name = name if name else recipient_email.split("@")[0]

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "IntraView AI - Verify Your Email"
        msg["From"] = sender_email
        msg["To"] = recipient_email

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Verify Your Email</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">IntraView AI</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Email Verification</p>
            </div>
            <div style="background-color: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1e293b; margin-top: 0;">Welcome, {greeting_name}! 👋</h2>
                <p style="color: #64748b; font-size: 16px;">
                    Thanks for signing up with IntraView AI. Please verify your email address using the code below:
                </p>
                <div style="background: linear-gradient(135deg, #f0f4ff, #e8ecff); border: 2px solid #4f46e5; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center;">
                    <p style="color: #4f46e5; margin: 0 0 10px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                    <div style="font-size: 42px; font-weight: bold; color: #4f46e5; letter-spacing: 12px; font-family: monospace;">
                        {otp}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
                <p style="color: #64748b; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2024 IntraView AI. All rights reserved.</p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Welcome to IntraView AI, {greeting_name}!

        Please verify your email with this code: {otp}

        This code expires in 10 minutes.

        If you didn't create an account, ignore this email.
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)

        print(f"Signup OTP email sent to {recipient_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Auth Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending signup OTP email: {type(e).__name__}: {e}")
        return False
