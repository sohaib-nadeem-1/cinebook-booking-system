import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  CreditCard,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Timer,
  User,
  Wallet,
  CheckCircle2,
  ChevronUp,
  TicketX,
} from "lucide-react";

import BookingSummary from "../../components/booking/BookingSummary.jsx";
import Button from "../../components/common/Button.jsx";
import Modal from "../../components/common/Modal.jsx";
import { Field, Checkbox } from "../../components/common/Field.jsx";
import {
  EmptyState,
  ErrorState,
  PageLoader,
} from "../../components/common/States.jsx";

import { seatService } from "../../services/seatService.js";
import { bookingService } from "../../services/bookingService.js";
import { settingsService } from "../../services/settingsService.js";

import { useAsync } from "../../hooks/useAsync.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBooking } from "../../context/BookingContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useDocTitle } from "../../hooks/useDocTitle.js";

import { calcPricing } from "../../utils/pricing.js";
import { store } from "../../utils/storage.js";
import { money } from "../../utils/format.js";

const METHODS = [
  ["card", "Credit / Debit card", CreditCard],
  ["wallet", "Digital wallet", Wallet],
  ["applepay", "Mobile pay", Smartphone],
];

const fmtClock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

export default function CheckoutPage() {
  useDocTitle("Checkout");

  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const { hold, remaining, expired, clear, setCombo } = useBooking();

  const sid = hold.showtimeId;

  const {
    data,
    loading,
    error,
    reload,
  } = useAsync(
    () => (sid ? seatService.getSeatMap(sid) : null),
    [sid]
  );

  const [contact, setContact] = useState({
    name: user?.guest ? "" : user?.name || "",
    email: user?.guest ? "" : user?.email || "",
    phone: user?.guest ? "" : user?.phone || "",
  });

  const [method, setMethod] = useState("card");

  const [card, setCard] = useState({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });

  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  const settings = settingsService.pricing();

  const pricing = useMemo(() => {
    if (!data) return null;

    return calcPricing(
      hold.seats,
      data.showtime.price,
      {
        taxRate: settings.cinema.taxRate,
        serviceFee: settings.system.serviceFee,
      },
      {
        combo: hold.combo,
      }
    );
  }, [
    data,
    hold.seats,
    hold.combo,
    settings.cinema.taxRate,
    settings.system.serviceFee,
  ]);

  useEffect(() => {
    document.getElementById("main")?.scrollTo?.(0, 0);
  }, []);

  if (!sid || !hold.seats.length) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <EmptyState
          icon={TicketX}
          title={expired ? "Your seat hold expired" : "No seats selected"}
          message={
            expired
              ? "Seats are only held for 10 minutes. Choose your seats again to continue — nothing was charged."
              : "Pick a movie, showtime and seats before checking out."
          }
          action={
            <Link
              to={expired ? `/booking/${expired}/seats` : "/movies"}
              className="btn-primary"
            >
              {expired ? "Select seats again" : "Browse movies"}
            </Link>
          }
        />
      </div>
    );
  }

  if (loading && !data) {
    return <PageLoader label="Preparing checkout…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Checkout unavailable"
        message={error.message}
        onRetry={reload}
      />
    );
  }

  if (!data || !pricing) return null;

  const { showtime } = data;

  const setC = (key) => (event) => {
    setContact((current) => ({
      ...current,
      [key]: event.target.value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: "",
    }));

    setFormError("");
  };

  const setK = (key, formatter = (value) => value) => (event) => {
    setCard((current) => ({
      ...current,
      [key]: formatter(event.target.value),
    }));

    const errorKey = key === "number" ? "cardNumber" : key;

    setErrors((current) => ({
      ...current,
      [errorKey]: "",
    }));

    setFormError("");
  };

  const confirm = async (event) => {
    event?.preventDefault();

    setFormError("");

    const validationErrors = {};

    if (!contact.name.trim()) {
      validationErrors.name = "Full name is required";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) {
      validationErrors.email = "Enter a valid email address";
    }

    if (!/^[+\d][\d\s().-]{6,19}$/.test(contact.phone)) {
      validationErrors.phone = "Enter a valid phone number";
    }

    if (method === "card") {
      if (!/^\d{13,19}$/.test(card.number.replace(/\s/g, ""))) {
        validationErrors.cardNumber =
          "Enter a valid card number (demo: 4242 4242 4242 4242)";
      }

      if (!card.name.trim()) {
        validationErrors.cardName = "Name on card is required";
      }

      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) {
        validationErrors.expiry = "Use MM/YY";
      }

      if (!/^\d{3,4}$/.test(card.cvc)) {
        validationErrors.cvc = "3–4 digits";
      }
    }

    if (!agree) {
      validationErrors.agree =
        "Please accept the booking terms to continue";
    }

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);

    try {
      // Backend currently accepts only showtimeId and seatsID.
      // Contact, payment and combo are not persisted by the backend.
      const booking = await bookingService.create({
        showtimeId: sid,
        seats: hold.seats,
      });

      const bookingId = booking?.id ?? booking?.booking?.id;

      if (!bookingId) {
        throw new Error("Booking was created but no booking ID was returned.");
      }

      store.set("lastBookingId", bookingId);

      clear();

      toast.success(`Booking confirmed! Your ID is ${bookingId}.`);

      nav("/booking-confirmation", {
        replace: true,
        state: {
          id: bookingId,
        },
      });
    } catch (err) {
      setBusy(false);

      if (err.status === 409 || err.code === "SEAT_TAKEN") {
        toast.error(err.message || "One or more selected seats are no longer available.");
        nav(`/booking/${sid}/seats`);
      } else if (err.errors) {
        setErrors(err.errors);
        toast.error(err.message);
      } else {
        setFormError(err.message || "Unable to complete this booking.");
        toast.error("Unable to complete this action.");
      }
    }
  };

  const section = "card p-5 md:p-6";

  return (
    <div className="max-w-[1400px] mx-auto px-margin-mobile md:px-margin py-6 pb-32 lg:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/booking/${sid}/seats`}
            aria-label="Back to seat selection"
            className="w-10 h-10 rounded-full bg-surface-container-high grid place-items-center hover:bg-surface-container-highest"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <h1 className="font-headline text-headline-md md:text-headline-lg font-bold text-white">
              Checkout
            </h1>

            <p className="text-body-sm text-on-surface-variant">
              Secure demo checkout — no real payment is taken.
            </p>
          </div>
        </div>

        <div
          role="timer"
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-label-md ${
            remaining <= 120
              ? "border-error/60 bg-error-container/30 text-error"
              : "border-white/10 bg-surface-container-low"
          }`}
        >
          <Timer className="w-4 h-4 text-secondary" aria-hidden />

          Seats held for

          <b className="tabular-nums" data-testid="hold-timer">
            {fmtClock(remaining)}
          </b>
        </div>
      </div>

      <form
        onSubmit={confirm}
        noValidate
        className="mt-6 grid gap-gutter lg:grid-cols-[1fr_420px] items-start"
      >
        <div className="space-y-gutter-mobile">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-error/40 bg-error-container/30 px-4 py-3 text-body-sm text-on-error-container"
            >
              {formError}
            </div>
          )}

          {/* Contact information */}
          <section className={section} aria-labelledby="c-contact">
            <h2
              id="c-contact"
              className="font-headline text-headline-sm text-white"
            >
              Contact information
            </h2>

            <p className="text-body-sm text-on-surface-variant">
              Your e-ticket and receipt are sent here.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <Field
                className="sm:col-span-2"
                label="Full name"
                icon={User}
                value={contact.name}
                onChange={setC("name")}
                error={errors.name}
                autoComplete="name"
                required
              />

              <Field
                label="Email"
                type="email"
                icon={Mail}
                value={contact.email}
                onChange={setC("email")}
                error={errors.email}
                autoComplete="email"
                required
              />

              <Field
                label="Phone"
                type="tel"
                icon={Phone}
                value={contact.phone}
                onChange={setC("phone")}
                error={errors.phone}
                autoComplete="tel"
                required
              />
            </div>

            {user?.guest && (
              <p className="mt-3 text-body-sm text-on-surface-variant">
                Checking out as a guest.{" "}
                <Link
                  to="/login"
                  state={{ from: "/checkout" }}
                  className="text-primary underline"
                >
                  Sign in
                </Link>{" "}
                to track bookings in My Bookings.
              </p>
            )}
          </section>

          {/* Demo payment */}
          <section className={section} aria-labelledby="c-pay">
            <h2
              id="c-pay"
              className="font-headline text-headline-sm text-white"
            >
              Payment
            </h2>

            <p className="text-body-sm text-on-surface-variant">
              Mock payment UI for the demo. Use card 4242 4242 4242 4242,
              any future date, any CVC. A card ending in 0002 simulates a
              decline.
            </p>

            <div
              role="radiogroup"
              aria-label="Payment method"
              className="mt-4 grid sm:grid-cols-3 gap-3"
            >
              {METHODS.map(([id, label, Icon]) => (
                <button
                  type="button"
                  key={id}
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    method === id
                      ? "border-primary-container bg-primary-container/10"
                      : "border-white/10 bg-surface-container hover:bg-surface-container-high"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      method === id
                        ? "text-primary-container"
                        : "text-on-surface-variant"
                    }`}
                    aria-hidden
                  />

                  <span className="text-label-md text-white">
                    {label}
                  </span>

                  {method === id && (
                    <CheckCircle2
                      className="w-4 h-4 ml-auto text-primary-container"
                      aria-hidden
                    />
                  )}
                </button>
              ))}
            </div>

            {method === "card" ? (
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <Field
                  className="sm:col-span-2"
                  label="Card number"
                  icon={CreditCard}
                  inputMode="numeric"
                  value={card.number}
                  onChange={setK("number", (value) =>
                    value
                      .replace(/[^\d]/g, "")
                      .slice(0, 19)
                      .replace(/(.{4})/g, "$1 ")
                      .trim()
                  )}
                  error={errors.cardNumber}
                  placeholder="4242 4242 4242 4242"
                  autoComplete="cc-number"
                />

                <Field
                  className="sm:col-span-2"
                  label="Name on card"
                  value={card.name}
                  onChange={setK("name")}
                  error={errors.cardName}
                  autoComplete="cc-name"
                />

                <Field
                  label="Expiry (MM/YY)"
                  value={card.expiry}
                  onChange={setK("expiry", (value) => {
                    const digits = value.replace(/\D/g, "").slice(0, 4);

                    return digits.length > 2
                      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                      : digits;
                  })}
                  error={errors.expiry}
                  placeholder="08/29"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                />

                <Field
                  label="CVC"
                  value={card.cvc}
                  onChange={setK("cvc", (value) =>
                    value.replace(/\D/g, "").slice(0, 4)
                  )}
                  error={errors.cvc}
                  placeholder="123"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                />
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-surface-container-lowest/70 border border-white/5 p-4 text-body-sm text-on-surface-variant">
                You’ll approve the payment of{" "}
                <b className="text-white">{money(pricing.total)}</b> with
                your{" "}
                {method === "wallet" ? "digital wallet" : "mobile pay"} when
                you confirm. (Simulated — no external window opens.)
              </p>
            )}
          </section>

          <Checkbox
            checked={agree}
            onChange={(event) => {
              setAgree(event.target.checked);

              setErrors((current) => ({
                ...current,
                agree: "",
              }));
            }}
            error={errors.agree}
            label="I agree to the booking terms and the refund policy: full refund up to 2 hours before showtime."
          />

          <div className="hidden lg:flex items-center gap-4 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Lock
                className="w-4 h-4 text-secondary"
                aria-hidden
              />
              256-bit SSL
            </span>

            <span className="flex items-center gap-1.5">
              <ShieldCheck
                className="w-4 h-4 text-secondary"
                aria-hidden
              />
              PCI-DSS Level 1 (production)
            </span>
          </div>
        </div>

        {/* Desktop order summary */}
        <aside
          className="hidden lg:block lg:sticky lg:top-28"
          aria-label="Order summary"
        >
          <div className="card p-5">
            <BookingSummary
              showtime={showtime}
              seats={hold.seats}
              pricing={pricing}
              combo={hold.combo}
              onCombo={setCombo}
            >
              <Button
                type="submit"
                className="w-full !py-3.5 !text-body-md"
                loading={busy}
                loadingText="Processing payment…"
                icon={Lock}
              >
                Confirm booking • {money(pricing.total)}
              </Button>
            </BookingSummary>
          </div>
        </aside>

        {/* Mobile bottom summary */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="flex-1 text-left"
              aria-label="View order summary"
            >
              <p className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                {hold.seats.length} seat
                {hold.seats.length === 1 ? "" : "s"} •{" "}
                {hold.seats.map((seat) => seat.id).join(", ")}

                <ChevronUp className="w-4 h-4 ml-auto" aria-hidden />
              </p>

              <p className="font-headline text-headline-sm font-bold text-white">
                {money(pricing.total)}
              </p>
            </button>

            <Button
              type="submit"
              className="shrink-0"
              loading={busy}
              loadingText="Processing…"
              icon={Lock}
            >
              Confirm
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title="Order summary"
      >
        <BookingSummary
          showtime={showtime}
          seats={hold.seats}
          pricing={pricing}
          combo={hold.combo}
          onCombo={setCombo}
        />
      </Modal>
    </div>
  );
}