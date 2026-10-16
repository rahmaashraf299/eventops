import mongoose from "mongoose";
import { userModel } from "../../../db/models/users.model.js";
import Event from "../../../db/models/eventModel.js";
import { bookingModel } from "../../../db/models/booking.model.js";
import { organizerApplicationModel } from "../../../db/models/organizerApplicationModel.js";

const getCollectionStats = async (model, dimensions) => {
  const facets = { total: [{ $count: "count" }] };

  for (const [key, field] of Object.entries(dimensions)) {
    facets[key] = [
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
  }

  const [result = {}] = await model.aggregate([{ $facet: facets }]);
  const stats = { total: result.total?.[0]?.count ?? 0 };

  for (const key of Object.keys(dimensions)) {
    stats[key] = Object.fromEntries(
      (result[key] || []).map(({ _id, count }) => [_id ?? "unknown", count]),
    );
  }

  return stats;
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved, or rejected",
      });
    }

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [users, events, bookings, organizerApplications] = await Promise.all([
      getCollectionStats(userModel, { byRole: "role", byStatus: "status" }),
      getCollectionStats(Event, { byVisibility: "visibility", byStatus: "status" }),
      getCollectionStats(bookingModel, { byStatus: "status" }),
      getCollectionStats(organizerApplicationModel, { byStatus: "status" }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: { users, events, bookings, organizerApplications },
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllEvents = async (req, res, next) => {
  try {
    const events = await Event.find({})
      .populate("organizer", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Events retrieved successfully",
      data: events,
    });
  } catch (error) {
    return next(error);
  }
};
