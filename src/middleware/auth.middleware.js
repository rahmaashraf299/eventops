import jwt from 'jsonwebtoken';
import { userModel } from '../../db/models/users.model.js';

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SecretKey123');

        const user = await userModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }


        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token", error: err.message });
    }
};

export const verifyOrganizer = (req, res, next) => {
    console.log("Organizer ID:", req.user?._id);
    console.log("Organizer email:", req.user?.email);
    console.log("Organizer status:", req.user?.status);
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "You must be logged in"
        });
    }

    if (req.user.role !== 'organizer') {
        return res.status(403).json({
            success: false,
            message: "Only organizers can manage events"
        });
    }

    if (req.user.status !== 'approved') {
        return res.status(403).json({
            success: false,
            message: "Your organizer account is not approved yet"
        });
    }

    next();
};

