import mongoose from 'mongoose';

const organizerApplicationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required']
        },
        organizationName: {
            type: String,
            required: [true, 'Organization name is required'],
            trim: true
        },
        status: {
            type: String,
            enum: {
                values: ['pending', 'approved', 'rejected'],
                message: '{VALUE} is not a valid status'
            },
            default: 'pending'
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewNotes: {
            type: String,
            default: null,
            trim: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Index to quickly look up applications by user and status
organizerApplicationSchema.index({ user: 1, status: 1 });

export const organizerApplicationModel = mongoose.model('OrganizerApplication', organizerApplicationSchema);
export default organizerApplicationModel;
