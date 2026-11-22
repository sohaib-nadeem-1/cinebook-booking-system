export const seatPriceFor = (category, showtime) => {
  if (category === "standard") return Number(showtime.standard_price);
  if (category === "prime") return Number(showtime.prime_price);
  if (category === "vip lounge") {
    // Existing CineBook rule: VIP costs 125% of prime, rounded to the nearest $0.50.
    return Math.round(Number(showtime.prime_price) * 1.25 * 2) / 2;
  }
  throw Object.assign(new Error(`Unsupported seat category: ${category}`), { statusCode: 400 });
};

export const totalPriceForSeats = (seats) => {
  const cents = seats.reduce((sum, seat) => {
    const price = Number(seat.price);
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error("Invalid price configured for this showtime"), { statusCode: 400 });
    }
    return sum + Math.round(price * 100);
  }, 0);
  return (cents / 100).toFixed(2);
};
