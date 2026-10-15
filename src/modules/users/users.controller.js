import { userModel } from "../../../db/models/users.model.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


const signup = async (req, res, next) => {
    try {
        let { name, email, password, role } = req.body;

        if (!['user', 'organizer'].includes(role)) {
            role = 'user';
        }

        let existingUser = await userModel.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const passwordHash = bcrypt.hashSync(password, 8);

        const userStatus = role === 'organizer'
            ? 'pending'
            : 'approved';

        let newUser = await userModel.create({
            name,
            email,
            passwordHash: passwordHash,
            role,
            status: userStatus
        });

        res.status(201).json({
            message: "User registered successfully",
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

const login = async (req, res, next) => {
    try {
        let { email, password } = req.body;

        let user = await userModel.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const match = bcrypt.compareSync(password, user.passwordHash);
        if (!match) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ message: "Your account is pending admin approval. You cannot login yet." });
        }

        // إنشاء JWT Token
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
    login,
    getProfile,
    updateProfile
};

