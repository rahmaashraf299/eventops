import { userModel } from "../../../db/models/users.model.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../../utilities/email.js';

const signup = async (req, res, next) => {
    try {
        let { name, email, password, role } = req.body;

        // Prevent direct admin registration
        if (role === 'admin') {
            return res.status(403).json({ message: "Registration as admin is not allowed." });
        }

        let existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        const passwordHash = bcrypt.hashSync(password, 8);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        let newUser = await userModel.create({
            name,
            email,
            passwordHash,
            role: role || 'participant',
            status: 'pending',
            verificationToken
        });

        const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;

        await sendEmail({
            email: newUser.email,
            subject: 'Email Verification - EventOps',
            html: `
                <h2>Welcome to EventOps, ${name}!</h2>
                <p>Please click the link below to verify your email and activate your account:</p>
                <a href="${verificationUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
            `
        });

        res.status(201).json({
            message: "User registered successfully. Please check your email to verify your account.",
            data: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                status: newUser.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error in signup", error: err.message });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        const user = await userModel.findOne({ verificationToken: token });
        if (!user) {
            return res.status(400).send("<h1>Invalid or expired verification link.</h1>");
        }

        user.status = 'active';
        user.verificationToken = undefined;
        await user.save();

        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial;">
                <h1 style="color: green;">Account Verified Successfully! 🎉</h1>
                <p>Your account is now active. You can go back to login and access your account.</p>
                <a href="http://localhost:3000/login" style="padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Back to Login</a>
            </div>
        `);
    } catch (err) {
        res.status(500).send("<h1>Server error during verification.</h1>");
    }
};

const login = async (req, res, next) => {
    try {
        let { email, password } = req.body;

        let user = await userModel.findOne({ email }).select('+passwordHash');
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const match = bcrypt.compareSync(password, user.passwordHash);
        if (!match) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ message: "Your account is pending email verification. Please check your inbox." });
        }

        if (user.status === 'blocked') {
            return res.status(403).json({ message: "Your account has been blocked. Contact support." });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'SecretKey123',
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error in login", error: err.message });
    }
};

const getProfile = async (req, res) => {
    try {
        res.status(200).json({
            message: "Profile fetched successfully",
            data: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                status: req.user.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching profile", error: err.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name } = req.body;

        if (name) req.user.name = name;
        await req.user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            data: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                status: req.user.status
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error updating profile", error: err.message });
    }
};

export {
    signup,
    verifyEmail,
    login,
    getProfile,
    updateProfile
};