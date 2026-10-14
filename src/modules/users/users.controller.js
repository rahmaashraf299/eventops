import { userModel } from "../../../db/models/userModel.js";
import bcrypt from 'bcrypt';

const signup = async (req, res, next) => {
    try {
        let { name, email, password, role } = req.body;

        let existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        const passwordHash = bcrypt.hashSync(password, 8);

     
        const userStatus = (role === 'organizer') ? 'pending' : 'approved';

        let newUser = await userModel.create({
            name,
            email,
            passwordHash,
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
        })

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

        res.status(200).json({
            message: "Login successful",
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

export {
    signup,
    login
};