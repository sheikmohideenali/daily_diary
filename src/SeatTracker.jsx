
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "thakos_seat_tracker_v1";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const getInitialData = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};

export default function SeatTracker() {
  const [seat, setSeat] = useState(getInitialData);
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [startMonth, setStartMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [payoutMonth, setPayoutMonth] = useState("");

  useEffect(() => {
    if (seat) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seat));
    }
  }, [seat]);

  const createSeat = (e) => {
    e.preventDefault();

    const monthlyAmount = Number(amount);
    const totalMonths = Number(months);

    if (
      !Number.isFinite(monthlyAmount) ||
      !Number.isInteger(totalMonths) ||
      monthlyAmount <= 0 ||
      totalMonths < 1 ||
      totalMonths > 120
    ) {
      alert("Enter a valid monthly amount and number of months.");
      return;
    }

    const [year, month] = startMonth.split("-").map(Number);

    const installments = Array.from({ length: totalMonths }, (_, index) => {
      const date = new Date(year, month - 1 + index, 1);

      return {
        id: `${index}-${date.getTime()}`,
        month: `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`,
        paid: false,
        paidDate: "",
      };
    });

    setSeat({
      monthlyAmount,
      totalMonths,
      startMonth,
      payoutMonth: "",
      installments,
    });
  };

  const updateInstallment = (id, paid) => {
    setSeat((current) => ({
      ...current,
      installments: current.installments.map((item) =>
        item.id === id
          ? {
              ...item,
              paid,
              paidDate: paid
                ? new Date().toISOString().slice(0, 10)
                : "",
            }
          : item
      ),
    }));
  };

  const paidCount =
    seat?.installments.filter((item) => item.paid).length || 0;

  const pendingCount = seat ? seat.totalMonths - paidCount : 0;
  const totalPaid = paidCount * (seat?.monthlyAmount || 0);
  const totalPending = pendingCount * (seat?.monthlyAmount || 0);

  const formatMonth = (value) => {
    if (!value) return "";
    const [year, month] = value.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  };

  const updatePayout = () => {
    setSeat((current) => ({
      ...current,
      payoutMonth,
    }));
  };

  const resetSeat = () => {
    if (
      window.confirm(
        "Delete this seat and all its payment records? This cannot be undone."
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      setSeat(null);
      setAmount("");
      setMonths("");
      setPayoutMonth("");
    }
  };

  return (
    <div className="seat-page">
      <div className="seat-header">
        <div>
          <p className="seat-eyebrow">THAKOS / FINANCE</p>
          <h1>Seat Management</h1>
          <p className="seat-subtitle">
            Track your monthly seat installments.
          </p>
        </div>
        {seat && <span className="seat-active">● ACTIVE SEAT</span>}
      </div>

      {!seat ? (
        <form className="seat-create-card" onSubmit={createSeat}>
          <div className="seat-icon">₹</div>
          <h2>Create Your Seat</h2>
          <p>Set your monthly contribution and installment period.</p>

          <label>Monthly Amount (₹)</label>
          <input
            type="number"
            min="1"
            step="1"
            required
            placeholder="Example: 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label>Number of Months</label>
          <input
            type="number"
            min="1"
            max="120"
            step="1"
            required
            placeholder="Example: 10"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />

          <label>Starting Month</label>
          <input
            type="month"
            required
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />

          <button className="seat-primary-btn" type="submit">
            Create Seat →
          </button>
        </form>
      ) : (
        <>
          <div className="seat-summary-grid">
            <div className="seat-stat-card">
              <span>Monthly Amount</span>
              <strong>{money(seat.monthlyAmount)}</strong>
            </div>

            <div className="seat-stat-card">
              <span>Total Paid</span>
              <strong className="seat-green">{money(totalPaid)}</strong>
            </div>

            <div className="seat-stat-card">
              <span>Total Pending</span>
              <strong className="seat-orange">{money(totalPending)}</strong>
            </div>

            <div className="seat-stat-card">
              <span>Installments Left</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>

          <div className="seat-progress-card">
            <div className="seat-progress-heading">
              <h3>Payment Progress</h3>
              <strong>
                {paidCount} / {seat.totalMonths} Paid
              </strong>
            </div>
            <div className="seat-progress-track">
              <div
                className="seat-progress-fill"
                style={{
                  width: `${(paidCount / seat.totalMonths) * 100}%`,
                }}
              />
            </div>
            <p>{Math.round((paidCount / seat.totalMonths) * 100)}% completed</p>
          </div>

          <div className="seat-section-heading">
            <div>
              <h2>Monthly Installments</h2>
              <p>Mark each month once the payment is completed.</p>
            </div>
          </div>

          <div className="seat-installments">
            {seat.installments.map((item, index) => (
              <div className="seat-installment" key={item.id}>
                <div className="seat-number">{index + 1}</div>

                <div className="seat-installment-info">
                  <strong>{formatMonth(item.month)}</strong>
                  <span>
                    {item.paid
                      ? `Paid on ${item.paidDate}`
                      : "Payment pending"}
                  </span>
                </div>

                <div className="seat-installment-right">
                  <strong>{money(seat.monthlyAmount)}</strong>
                  <button
                    type="button"
                    className={
                      item.paid
                        ? "seat-paid-btn"
                        : "seat-pending-btn"
                    }
                    onClick={() =>
                      updateInstallment(item.id, !item.paid)
                    }
                  >
                    {item.paid ? "✓ PAID" : "MARK PAID"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="seat-payout-card">
            <h3>Kulukal Payout</h3>
            <p>
              Record the month in which you received the seat amount.
              This does not change installment payment statuses.
            </p>

            <div className="seat-payout-controls">
              <input
                type="month"
                value={payoutMonth || seat.payoutMonth}
                onChange={(e) => setPayoutMonth(e.target.value)}
              />
              <button
                type="button"
                className="seat-primary-btn"
                onClick={updatePayout}
              >
                Save Payout Month
              </button>
            </div>

            {seat.payoutMonth && (
              <p className="seat-payout-saved">
                ✓ Payout received in {formatMonth(seat.payoutMonth)}
              </p>
            )}
          </div>

          {pendingCount === 0 && (
            <div className="seat-completed">
              ✓ All installments completed!
            </div>
          )}

          <button className="seat-reset-btn" onClick={resetSeat}>
            Delete Seat
          </button>
        </>
      )}
    </div>
  );
}
