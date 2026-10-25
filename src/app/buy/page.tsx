"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bus, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/api";

type Trip = {
  id: string; from: string; to: string; date: string; departureTime: string;
  arrivalTime?: string; price: number; currency: string; totalSeats: number;
  availableSeats: number; operatorName: string;
};
type Checkout = { bookingId: string; guestToken: string; bookingCode: string; paymentReference?: string; totalAmount: number };

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `${Number(n || 0).toLocaleString()} RWF`;

export default function BuyTicketPage() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(today());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [passengerCount, setPassengerCount] = useState("1");
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [phase, setPhase] = useState<"search" | "details" | "waiting" | "success" | "failed">("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const searchTrips = async () => {
    setBusy(true); setError(""); setTrip(null); setTrips([]);
    try {
      if (!from.trim() || !to.trim() || from.trim().toLowerCase() === to.trim().toLowerCase()) {
        throw new Error("Enter different origin and destination towns.");
      }
      const { data, error: invokeError } = await supabase.functions.invoke("guest-checkout?action=trips", {
        body: { from: from.trim(), to: to.trim(), date },
      });
      if (invokeError) throw new Error(invokeError.message || "Could not search trips.");
      if (data?.error) throw new Error(data.error);
      const found = Array.isArray(data?.trips) ? data.trips as Trip[] : [];
      setTrips(found);
      setPhase("search");
      if (!found.length) setError("No scheduled trips match this route and date. Try another date.");
    } catch (e: any) { setError(e?.message || "Trip search failed."); }
    finally { setBusy(false); }
  };

  const chooseTrip = (selected: Trip) => {
    setTrip(selected); setPassengerCount("1"); setPhase("details"); setError(""); setMessage("");
  };

  const refreshPayment = async (activeCheckout = checkout) => {
    if (!activeCheckout) return;
    const { data, error: invokeError } = await supabase.functions.invoke("guest-checkout?action=status", {
      body: { bookingId: activeCheckout.bookingId, guestToken: activeCheckout.guestToken },
    });
    if (invokeError) throw new Error(invokeError.message || "Could not check payment status.");
    if (data?.status === "success") {
      setPhase("success"); setMessage("MTN confirmed your payment. Your e-ticket is ready.");
      return "success";
    }
    if (data?.status === "failed") {
      setPhase("failed"); setError(data.message || "MTN did not confirm payment. Your reservation has been released.");
      return "failed";
    }
    setMessage(data?.message || "Waiting for MTN confirmation. Keep this page open.");
    return "pending";
  };

  const payNow = async () => {
    setError(""); setMessage("");
    if (!trip) return;
    const count = Number(passengerCount);
    if (!Number.isInteger(count) || count < 1 || count > 10 || count > trip.availableSeats) {
      setError(`Choose between 1 and ${Math.min(10, trip.availableSeats)} passengers.`); return;
    }
    if (!passengerName.trim() || !momoName.trim()) { setError("Enter the passenger name and the name registered on the MoMo account."); return; }
    const passengerMsisdn = normalizePhone(passengerPhone);
    const momoMsisdn = normalizePhone(momoNumber);
    if (!passengerMsisdn || !momoMsisdn) { setError("Enter valid Rwanda mobile numbers, such as 0788123456."); return; }
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("guest-checkout", {
        body: { tripId: trip.id, passengerName: passengerName.trim(), passengerPhone: passengerMsisdn,
          passengerCount: count, momoName: momoName.trim(), momoNumber: momoMsisdn },
      });
      if (invokeError) throw new Error(invokeError.message || "Could not start MTN checkout.");
      if (data?.error) throw new Error(data.error);
      if (!data?.bookingId || !data?.guestToken) throw new Error("Checkout did not return secure ticket access.");
      const current: Checkout = { bookingId: data.bookingId, guestToken: data.guestToken, bookingCode: data.bookingCode, paymentReference: data.paymentReference, totalAmount: Number(data.totalAmount || trip.price * count) };
      setCheckout(current); setPhase("waiting");
      setMessage("Approve the MTN MoMo prompt on your phone. Your ticket stays inactive until payment is confirmed.");
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        let status: string | undefined;
        try {
          status = await refreshPayment(current);
        } catch {
          // A temporary status-check outage is not proof that payment failed.
          setMessage("MTN status is temporarily unavailable. Keep this request open and do not pay again while it is pending.");
          continue;
        }
        if (status === "success" || status === "failed") return;
      }
      setMessage("Payment is still pending. You can keep checking here; the ticket will activate only after MTN confirms.");
    } catch (e: any) { setPhase(checkout ? "failed" : "details"); setError(e?.message || "Checkout failed."); }
    finally { setBusy(false); }
  };

  const openTicket = () => {
    if (!checkout) return;
    router.push(`/ticket/${encodeURIComponent(checkout.bookingId)}#access=${encodeURIComponent(checkout.guestToken)}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#073D27] text-white">
        <div className="mx-auto max-w-3xl px-5 py-5 flex items-center justify-between">
          <button onClick={() => router.push("/splash")} className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white"><ArrowLeft size={18}/> Urugendo</button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><ShieldCheck size={14}/> Secure guest checkout</span>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-3">
          <p className="text-emerald-200 text-xs font-extrabold uppercase tracking-[0.18em]">No account needed</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Your next trip starts here.</h1>
          <p className="mt-2 max-w-xl text-sm text-white/75">Choose your route, confirm your details, approve MTN MoMo and receive your e-ticket.</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-9 space-y-5">
        {phase === "search" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="font-extrabold text-lg">Where are you going?</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <label className="text-xs font-bold text-slate-500">FROM
                  <input value={from} onChange={e=>setFrom(e.target.value)} placeholder="e.g. Kigali" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/>
                </label>
                <label className="text-xs font-bold text-slate-500">TO
                  <input value={to} onChange={e=>setTo(e.target.value)} placeholder="e.g. Musanze" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/>
                </label>
                <label className="text-xs font-bold text-slate-500 sm:col-span-2">TRAVEL DATE
                  <input type="date" min={today()} value={date} onChange={e=>setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/>
                </label>
              </div>
              {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
              <button onClick={searchTrips} disabled={busy} className="mt-4 w-full rounded-xl bg-[#00B14F] px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-60">{busy ? "Searching trips…" : "Search buses"}</button>
            </section>
            {trips.map(item => (
              <button key={item.id} onClick={()=>chooseTrip(item)} className="w-full text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-500 transition">
                <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-lg">{item.from} <span className="text-emerald-600">→</span> {item.to}</p><p className="mt-1 text-sm text-slate-500">{item.operatorName}</p></div><p className="font-black text-emerald-700">{money(item.price)}</p></div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={14}/>{item.date}</span><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{item.departureTime || "Time TBC"}</span><span className="inline-flex items-center gap-1"><Users size={14}/>{item.availableSeats} seats left</span></div>
                <p className="mt-4 text-sm font-bold text-emerald-700">Choose this trip <ArrowRight size={15} className="inline"/></p>
              </button>
            ))}
          </>
        )}

        {phase === "details" && trip && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <button onClick={()=>setPhase("search")} className="text-sm font-bold text-slate-500 inline-flex items-center gap-1"><ArrowLeft size={16}/> Change trip</button>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="font-black text-lg">{trip.from} → {trip.to}</p><p className="text-sm text-slate-600 mt-1">{trip.date} · {trip.departureTime || "Departure time TBC"}</p><p className="text-sm text-slate-600 mt-1">{trip.availableSeats} seats available · {money(trip.price)} per passenger</p></div>
            <h2 className="mt-5 font-extrabold text-lg">Passenger & payment details</h2>
            <p className="mt-1 text-sm text-slate-500">No sign-up required. Your secure ticket link is issued after the reservation is created.</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-500 sm:col-span-2">PASSENGER FULL NAME<input value={passengerName} onChange={e=>setPassengerName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/></label>
              <label className="text-xs font-bold text-slate-500">PASSENGER PHONE<input value={passengerPhone} onChange={e=>setPassengerPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="078…" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/></label>
              <label className="text-xs font-bold text-slate-500">NUMBER OF PASSENGERS<input type="number" min="1" max={Math.min(10,trip.availableSeats)} value={passengerCount} onChange={e=>setPassengerCount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/></label>
              <label className="text-xs font-bold text-slate-500">NAME ON MTN MOMO<input value={momoName} onChange={e=>setMomoName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/></label>
              <label className="text-xs font-bold text-slate-500">MTN MOMO NUMBER<input value={momoNumber} onChange={e=>setMomoNumber(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="078…" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"/></label>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 p-4 flex items-center justify-between"><span className="text-sm text-slate-600">Total for {Math.max(1,Number(passengerCount)||1)} passenger(s)</span><strong className="text-lg">{money(trip.price*Math.max(1,Number(passengerCount)||1))}</strong></div>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            <button onClick={payNow} disabled={busy} className="mt-4 w-full rounded-xl bg-[#00B14F] px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-60">{busy ? "Starting secure checkout…" : "Pay Now with MTN MoMo"}</button>
            <p className="mt-3 text-xs leading-5 text-slate-500">Never share your MoMo PIN with Urugendo. Enter it only in the official MTN prompt on your phone. Urugendo does not collect or store your PIN.</p>
          </section>
        )}

        {(phase === "waiting" || phase === "success" || phase === "failed") && checkout && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            {phase === "waiting" ? <Loader2 className="mx-auto animate-spin text-emerald-600" size={40}/> : phase === "success" ? <CheckCircle2 className="mx-auto text-emerald-600" size={44}/> : <Bus className="mx-auto text-red-600" size={42}/>}
            <h2 className="mt-4 text-xl font-black">{phase === "success" ? "Payment confirmed!" : phase === "failed" ? "Payment not confirmed" : "Approve payment on your phone"}</h2>
            <p className="mt-2 text-sm text-slate-600">{message || error}</p>
            <p className="mt-3 text-xs text-slate-500">Booking reference: {checkout.bookingCode || checkout.bookingId}</p>
            {phase === "success" ? <button onClick={openTicket} className="mt-5 w-full rounded-xl bg-[#00B14F] px-4 py-3.5 font-extrabold text-white">Bika itike yawe · Get your e-ticket</button> :
              phase === "waiting" ? <button onClick={()=>refreshPayment().catch(e=>setError(e.message))} disabled={busy} className="mt-5 w-full rounded-xl border border-emerald-600 px-4 py-3 font-bold text-emerald-700">Check payment status</button> :
              <button onClick={()=>{setPhase("details");setCheckout(null);setError("");}} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Try again</button>}
            {phase !== "success" && phase !== "failed" && <p className="mt-3 text-xs text-slate-500">Your ticket is inactive until MTN confirms payment. Do not pay again while this request is pending.</p>}
          </section>
        )}
      </div>
    </main>
  );
}
