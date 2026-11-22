import { useEffect, useMemo, useState } from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  ChevronUp,
  TicketX,
} from "lucide-react";

import BookingSummary from "../../components/booking/BookingSummary.jsx";
import Button from "../../components/common/Button.jsx";
import Modal from "../../components/common/Modal.jsx";

import { Checkbox } from "../../components/common/Field.jsx";

import {
  EmptyState,
  ErrorState,
  PageLoader,
} from "../../components/common/States.jsx";

import { seatService } from "../../services/seatService.js";
import { bookingService } from "../../services/bookingService.js";

import { useAsync } from "../../hooks/useAsync.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBooking } from "../../context/BookingContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useDocTitle } from "../../hooks/useDocTitle.js";

import { calcPricing } from "../../utils/pricing.js";
import { store } from "../../utils/storage.js";
import { money } from "../../utils/format.js";

export default function CheckoutPage() {
  useDocTitle("Checkout");

  const nav = useNavigate();
  const toast = useToast();

  const { user } = useAuth();

  const {
    hold,
    clear,
  } = useBooking();

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

  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  const pricing = useMemo(
    () =>
      data
        ? calcPricing(hold.seats)
        : null,
    [
      data,
      hold.seats,
    ]
  );

  useEffect(() => {
    document.getElementById("main")?.scrollTo?.(0, 0);
  }, []);

  if (!sid || !hold.seats.length) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <EmptyState
          icon={TicketX}
          title="No seats selected"
          message="Pick a movie, showtime and seats before checking out."
          action={
            <Link to="/movies" className="btn-primary">
              Browse movies
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

  const validateForm = () => {
    const validationErrors = {};
    if (!agree) {
      validationErrors.agree = "Please acknowledge the booking terms to continue";
    }
    return validationErrors;
  };

  const confirm = async (event) => {
    event?.preventDefault();

    setFormError("");

    const validationErrors = validateForm();

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);

    try {
      // Only send data supported by the backend.
      const createdBooking = await bookingService.create({
        showtimeId: sid,
        seats: hold.seats,
      });

      store.set(
        "lastBookingId",
        createdBooking.id
      );

      clear();

      toast.success(
        `Booking confirmed! Your ID is ${createdBooking.id}.`
      );

      nav("/booking-confirmation", {
        replace: true,
        state: {
          id: createdBooking.id,
        },
      });
    } catch (err) {
      if (err.code === "SEAT_TAKEN") {
        toast.error(err.message);
        nav(`/booking/${sid}/seats`);
        return;
      }

      if (err.errors) {
        setErrors(err.errors);
        toast.error(err.message);
      } else {
        setFormError(err.message);
        toast.error(
          "Unable to complete this booking."
        );
      }
    } finally {
      setBusy(false);
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
              Confirming creates an unpaid booking; no charge is made.
            </p>
          </div>
        </div>

        <p className="max-w-sm text-right text-body-sm text-on-surface-variant">
          Seat availability is checked again at confirmation. No payment is processed.
        </p>
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

          <section className={section} aria-labelledby="c-account">
            <h2 id="c-account" className="font-headline text-headline-sm text-white">
              Booking account
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              This booking will be linked to your signed-in account.
            </p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
              <dt className="text-on-surface-variant">Name</dt>
              <dd className="text-right text-white">{user?.name || "Not provided"}</dd>
              <dt className="text-on-surface-variant">Email</dt>
              <dd className="text-right text-white break-all">{user?.email || "Not provided"}</dd>
              <dt className="text-on-surface-variant">Phone</dt>
              <dd className="text-right text-white">{user?.phone || "Not provided"}</dd>
            </dl>
          </section>

          <section className={section} aria-labelledby="c-pay">
            <h2 id="c-pay" className="font-headline text-headline-sm text-white">
              Payment status
            </h2>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              A payment provider is not connected. Confirming creates a booking but does not charge you or mark it as paid. No card details are requested.
            </p>
          </section>

          <Checkbox
            checked={agree}
            onChange={(event) =>
              setAgree(event.target.checked)
            }
            error={errors.agree}
            label="I understand this booking is not a payment and my seats are not reserved until confirmation."
          />

          <div className="hidden lg:flex items-center gap-4 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-secondary" />
              Booking confirmation
            </span>

            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-secondary" />
              No payment provider connected
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
            >
              <Button
                type="submit"
                className="w-full !py-3.5 !text-body-md"
                loading={busy}
                loadingText="Confirming booking…"
                icon={Lock}
              >
                Confirm booking • {money(pricing.total)}
              </Button>
            </BookingSummary>
          </div>
        </aside>

        {/* Mobile bottom checkout summary */}
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

                <ChevronUp className="w-4 h-4 ml-auto" />
              </p>

              <p className="font-headline text-headline-sm font-bold text-white">
                {money(pricing.total)}
              </p>
            </button>

            <Button
              type="submit"
              className="shrink-0"
              loading={busy}
              loadingText="Confirming…"
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
        />
      </Modal>
    </div>
  );
}