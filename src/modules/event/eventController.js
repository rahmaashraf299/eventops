import Event from "../../../db/models/eventModel.js";

export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      startsAt,
      endsAt,
      registrationDeadline,
      capacity,
      price,
      visibility,
      invitedEmails,
    } = req.body;

    const event = await Event.create({
      organizer: req.user._id,
      title,
      description,
      venue,
      startsAt,
      endsAt,
      registrationDeadline,
      capacity,
      price,
      visibility,
      invitedEmails,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to create event",
      errors: error.message,
    });
  }
};


export const getAllEvents = async (req, res) => {
    try {
        const {
            search,
            venue,
            minPrice,
            maxPrice,
            startsAfter,
            startsBefore,
            sort
        } = req.query;

        const filter = {
            visibility: 'public',
            status: 'scheduled'
        };

        if (search) {
            filter.title = {
                $regex: search,
                $options: 'i'
            };
        }

        if (venue) {
            filter.venue = {
                $regex: venue,
                $options: 'i'
            };
        }

        if (minPrice !== undefined) {
            filter.price = {
                ...filter.price,
                $gte: Number(minPrice)
            };
        }

        if (maxPrice !== undefined) {
            filter.price = {
                ...filter.price,
                $lte: Number(maxPrice)
            };
        }

        if (startsAfter || startsBefore) {
            filter.startsAt = {};

            if (startsAfter) {
                filter.startsAt.$gte = new Date(startsAfter);
            }

            if (startsBefore) {
                filter.startsAt.$lte = new Date(startsBefore);
            }
        }

        let sortOption = { startsAt: 1 };

        if (sort === 'price') {
            sortOption = { price: 1 };
        } else if (sort === '-price') {
            sortOption = { price: -1 };
        } else if (sort === '-startsAt') {
            sortOption = { startsAt: -1 };
        }

        const events = await Event.find(filter).sort(sortOption);

        return res.status(200).json({
            success: true,
            message: 'Events retrieved successfully',
            data: events
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve events',
            errors: error.message
        });
    }
};



export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findOne({
      _id: id,
      visibility: "public",
      status: "scheduled",
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event retrieved successfully",
      data: event,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve event",
      errors: error.message,
    });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to update an event",
      });
    }

    const event = await Event.findOne({
      _id: id,
      organizer: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const startsAt = new Date(req.body.startsAt ?? event.startsAt);
    const endsAt = new Date(req.body.endsAt ?? event.endsAt);
    const registrationDeadline = new Date(
      req.body.registrationDeadline ?? event.registrationDeadline,
    );

    if (endsAt <= startsAt) {
      return res.status(400).json({
        success: false,
        message: "Event end time must be after start time",
      });
    }

    if (registrationDeadline > startsAt) {
      return res.status(400).json({
        success: false,
        message:
          "Registration deadline must be before or at the event start time",
      });
    }

    Object.assign(event, req.body);

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to update event",
      errors: error.message,
    });
  }
};

export const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to cancel an event",
      });
    }

    const event = await Event.findOne({
      _id: id,
      organizer: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Event is already cancelled",
      });
    }

    event.status = "cancelled";

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      data: event,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel event",
      errors: error.message,
    });
  }
};
