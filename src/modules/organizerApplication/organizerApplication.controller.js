import mongoose from 'mongoose';
import { organizerApplicationModel } from '../../../db/models/organizerApplicationModel.js';
import { userModel } from '../../../db/models/userModel.js';

/**
 * @desc   Submit an application to become an Organizer
 * @route  POST /api/organizer-applications
 * @access Private (User)
 */
export const applyForOrganizer = async (req, res) => {
    try {
        const userId = req.user._id;
        const { organizationName } = req.body;

        // 1. Check if user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });
        }

        // 2. Check if user is already an organizer or admin
        if (user.role === 'organizer' || user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: `You are already registered as an ${user.role}`
            });
        }

        // 3. Check for existing pending application
        const existingPending = await organizerApplicationModel.findOne({
            user: userId,
            status: 'pending'
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending organizer application under review'
            });
        }

        // 4. Create new application
        const newApplication = await organizerApplicationModel.create({
            user: userId,
            organizationName,
            status: 'pending'
        });

        return res.status(201).json({
            success: true,
            message: 'Organizer application submitted successfully',
            data: newApplication
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server error while submitting organizer application',
            error: err.message
        });
    }
};

/**
 * @desc   Get the logged-in user's own applications
 * @route  GET /api/organizer-applications/me
 * @access Private (User)
 */
export const getMyApplications = async (req, res) => {
    try {
        const userId = req.user._id;

        const applications = await organizerApplicationModel.find({ user: userId })
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Applications retrieved successfully',
            data: applications
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching user applications',
            error: err.message
        });
    }
};

/**
 * @desc   Get all organizer applications for Admin review
 * @route  GET /api/admin/organizer-applications
 * @access Private (Admin only)
 */
export const getAllApplications = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const total = await organizerApplicationModel.countDocuments(filter);

        const applications = await organizerApplicationModel.find(filter)
            .populate('user', 'name email role status')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit, 10));

        return res.status(200).json({
            success: true,
            message: 'Organizer applications retrieved successfully',
            data: applications,
            pagination: {
                total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching applications',
            error: err.message
        });
    }
};

/**
 * @desc   Approve or reject an organizer application
 * @route  PATCH /api/admin/organizer-applications/:id
 * @access Private (Admin only)
 */
export const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNotes } = req.body;
        const adminId = req.user._id;

        // 1. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application ID format'
            });
        }

        // 2. Find application
        const application = await organizerApplicationModel.findById(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Organizer application not found'
            });
        }

        // 3. Update application fields
        application.status = status;
        application.reviewedBy = adminId;
        application.reviewedAt = new Date();
        if (reviewNotes !== undefined) {
            application.reviewNotes = reviewNotes;
        }

        await application.save();

        // 4. If approved, promote user role to 'organizer' and status to 'approved'
        if (status === 'approved') {
            await userModel.findByIdAndUpdate(application.user, {
                role: 'organizer',
                status: 'approved'
            });
        }

        // 5. Populate and return updated application
        const populatedApplication = await organizerApplicationModel.findById(id)
            .populate('user', 'name email role status')
            .populate('reviewedBy', 'name email');

        return res.status(200).json({
            success: true,
            message: `Application has been ${status} successfully`,
            data: populatedApplication
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Server error while reviewing application',
            error: err.message
        });
    }
};

export default {
    applyForOrganizer,
    getMyApplications,
    getAllApplications,
    reviewApplication
};
