import jwt from 'jsonwebtoken';
import { userModel } from '../../db/models/userModel.js';

export const verifyToken = async (req, res, next) => {
    try {
        let token = req.headers.token || req.headers.authorization;
        const headerUserId = req.headers.userid || req.headers['user-id'];

        // 1. If JWT token is provided
        if (token) {
            if (token.startsWith('Bearer ')) {
                token = token.slice(7).trim();
            }

            try {
                const secret = process.env.JWT_SECRET || 'itig4';
                const decoded = jwt.verify(token, secret);
                decoded._id = decoded._id || decoded.id;

                const user = await userModel.findById(decoded._id);
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'User belonging to this token no longer exists'
                    });
                }

                req.user = user;
                return next();
            } catch (err) {
                // If token invalid and no fallback userId, return 401
                if (!headerUserId) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid or expired token',
                        error: err.message
                    });
                }
            }
        }

        // 2. Direct userId support (helpful for testing and before JWT integration)
        if (headerUserId) {
            const user = await userModel.findById(headerUserId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User with provided userId header not found'
                });
            }

            req.user = user;
            return next();
        }

        // 3. Neither token nor userId provided
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please provide a token or userId in headers.'
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Internal error in auth middleware',
            error: err.message
        });
    }
};

export const allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of roles: ${roles.join(', ')}`,
                currentRole: req.user ? req.user.role : 'none'
            });
        }
        next();
    };
};

export default { verifyToken, allowRoles };
