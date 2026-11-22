import { api, ApiError } from "./api.js";
import { showtimeService } from "./showtimeService.js";

const API_ENDPOINT = "/seats";

const fetchSeatAvailability = async (showtimeId) => {
  const response = await api.get(`${API_ENDPOINT}/showtime/${showtimeId}`);
  if (!Array.isArray(response?.seats)) {
    throw new ApiError("Invalid seat availability response.", "INVALID_RESPONSE");
  }
  return response.seats;
};

const toUiTier = (category) => category === "vip lounge" ? "vip" : category;

const mapSeat = (seat, prices) => {
  const category = seat.seat_category || seat.category;
  const tier = toUiTier(category);
  return {
    ...seat,
    // id is the actual seat label (for example A1); dbId/seatId is PostgreSQL's ID.
    id: String(seat.id),
    dbId: Number(seat.dbId ?? seat.seatId),
    seatId: Number(seat.dbId ?? seat.seatId),
    row: String(seat.row || ""),
    number: Number(seat.number),
    category,
    type: tier,
    tier,
    price: Number.isFinite(Number(prices[tier])) ? Number(prices[tier]) : 0,
    status: seat.status,
  };
};

// Derive the visible map from this auditorium's actual seat records. The aisle
// is placed near the middle of each row; no demo capacity or seat labels are used.
const buildLayout = (seats) => {
  const grouped = new Map();
  for (const seat of seats) {
    if (!grouped.has(seat.row)) grouped.set(seat.row, []);
    grouped.get(seat.row).push(seat);
  }

  const categoryNames = {
    standard: "Standard seating",
    prime: "Prime seating",
    vip: "VIP Lounge",
    mixed: "Mixed seat categories",
  };
  const rows = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map(([id, rowSeats]) => {
      const categories = [...new Set(rowSeats.map((seat) => seat.tier))];
      return { id, tier: categories.length === 1 ? categories[0] : "mixed" };
    });

  const tiers = ["standard", "prime", "vip", "mixed"]
    .filter((tier) => rows.some((row) => row.tier === tier))
    .map((id) => ({
      id,
      title: categoryNames[id],
      rows: "",
      priceKey: id === "mixed" ? null : id,
    }));

  return { rows, tiers };
};

export const seatService = {
  getSeatMap: async (showtimeId) => {
    const id = Number(showtimeId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError("Invalid showtime ID.", "VALIDATION", 400);
    }

    const [showtime, rawSeats] = await Promise.all([
      showtimeService.get(id),
      fetchSeatAvailability(id),
    ]);
    if (!showtime) throw new ApiError("Showtime not found.", "NOT_FOUND", 404);

    const prime = Number(showtime.primePrice);
    const prices = {
      standard: Number(showtime.standardPrice),
      prime,
      // Mirrors the server's VIP rule; the backend remains the booking authority.
      vip: Math.round(prime * 1.25 * 2) / 2,
    };
    const seats = rawSeats.map((seat) => mapSeat(seat, prices));

    return {
      showtime,
      layout: buildLayout(seats),
      seats,
      prices,
    };
  },

  verify: async (showtimeId, selectedSeatIds) => {
    if (!Array.isArray(selectedSeatIds)) {
      throw new ApiError("Selected seats must be an array.", "VALIDATION", 400);
    }
    const rawSeats = await fetchSeatAvailability(showtimeId);
    const seatMap = new Map(rawSeats.map((seat) => [Number(seat.dbId ?? seat.seatId), seat]));
    const taken = selectedSeatIds.filter((seatId) => {
      const seat = seatMap.get(Number(seatId));
      return !seat || seat.status !== "available";
    });
    return { ok: taken.length === 0, taken };
  },
};
