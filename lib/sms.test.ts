import { describe, expect, it } from "vitest";
import { SMS_TEMPLATES } from "./translations";
import type { SmsMessage } from "./types";

describe("SMS Notification System (Feature-Phone Simulator)", () => {
  const sampleBookingSms: SmsMessage = {
    id: "sms-101",
    createdAt: Date.now(),
    kind: "booking",
    deliveryStatus: "received",
    tokenNumber: "KS-108",
    centreName: "Belvai Primary Agri Co-op",
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    farmerId: "farmer-ramesh",
    arrivalWindow: "12:30 PM – 12:50 PM",
  };

  const sampleStatusSms: SmsMessage = {
    id: "sms-102",
    createdAt: Date.now(),
    kind: "status",
    deliveryStatus: "received",
    tokenNumber: "KS-108",
    centreName: "Belvai Primary Agri Co-op",
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    farmerId: "farmer-ramesh",
    stageKey: "weighed",
  };

  const samplePaymentSms: SmsMessage = {
    id: "sms-103",
    createdAt: Date.now(),
    kind: "payment",
    deliveryStatus: "received",
    tokenNumber: "KS-108",
    centreName: "Belvai Primary Agri Co-op",
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    farmerId: "farmer-ramesh",
    stageKey: "paymentReceived",
    amountInr: 34500,
    paymentRef: "PAY-108-2026",
  };

  it("formats booking SMS in English with dynamic crop, quantity, token, and centre", () => {
    const text = SMS_TEMPLATES.en.booking(
      sampleBookingSms.tokenNumber,
      sampleBookingSms.centreName,
      sampleBookingSms.arrivalWindow!,
      sampleBookingSms.crop,
      sampleBookingSms.quantityQuintals,
    );
    expect(text).toContain("KS-108");
    expect(text).toContain("Paddy / Rice (15q)");
    expect(text).toContain("Belvai Primary Agri Co-op");
    expect(text).toContain("12:30 PM – 12:50 PM");
  });

  it("formats booking SMS in Kannada with dynamic fields", () => {
    const text = SMS_TEMPLATES.kn.booking(
      sampleBookingSms.tokenNumber,
      sampleBookingSms.centreName,
      sampleBookingSms.arrivalWindow!,
      sampleBookingSms.crop,
      sampleBookingSms.quantityQuintals,
    );
    expect(text).toContain("KS-108");
    expect(text).toContain("Paddy / Rice 15 ಕ್ವಿಂಟಾಲ್");
    expect(text).toContain("Belvai Primary Agri Co-op");
    expect(text).toContain("ಕಿಸಾನ್‌ಸಿಂಕ್");
  });

  it("formats booking SMS in Hindi with dynamic fields", () => {
    const text = SMS_TEMPLATES.hi.booking(
      sampleBookingSms.tokenNumber,
      sampleBookingSms.centreName,
      sampleBookingSms.arrivalWindow!,
      sampleBookingSms.crop,
      sampleBookingSms.quantityQuintals,
    );
    expect(text).toContain("KS-108");
    expect(text).toContain("Paddy / Rice 15 क्विंटल");
    expect(text).toContain("Belvai Primary Agri Co-op");
    expect(text).toContain("किसानसिंक");
  });

  it("formats status update SMS dynamically across languages", () => {
    const enText = SMS_TEMPLATES.en.status(
      sampleStatusSms.tokenNumber,
      sampleStatusSms.centreName,
      "Weighed",
      sampleStatusSms.crop,
    );
    expect(enText).toContain("KS-108 (Paddy / Rice)");
    expect(enText).toContain("Weighed");

    const hiText = SMS_TEMPLATES.hi.status(
      sampleStatusSms.tokenNumber,
      sampleStatusSms.centreName,
      "वजन किया गया",
      sampleStatusSms.crop,
    );
    expect(hiText).toContain("KS-108 (Paddy / Rice)");
    expect(hiText).toContain("वजन किया गया");
  });

  it("formats payment update SMS dynamically with INR amount and reference", () => {
    const enText = SMS_TEMPLATES.en.payment(
      samplePaymentSms.tokenNumber,
      samplePaymentSms.centreName,
      `₹${samplePaymentSms.amountInr?.toLocaleString("en-IN")}`,
      samplePaymentSms.paymentRef!,
    );
    expect(enText).toContain("KS-108");
    expect(enText).toContain("₹34,500");
    expect(enText).toContain("PAY-108-2026");
  });

  it("handles fallback gracefully when crop is omitted", () => {
    const text = SMS_TEMPLATES.en.booking("KS-109", "Moodbidri APMC Sub-Yard", "10:00 AM – 10:20 AM");
    expect(text).toBe("KisanSync: Your token KS-109 is booked at Moodbidri APMC Sub-Yard. Expected arrival: 10:00 AM – 10:20 AM.");
  });

  it("supports distinguishing received and pending delivery states", () => {
    const pendingSms: SmsMessage = {
      ...sampleBookingSms,
      id: "sms-pending-1",
      deliveryStatus: "pending",
    };
    expect(sampleBookingSms.deliveryStatus).toBe("received");
    expect(pendingSms.deliveryStatus).toBe("pending");
  });
});
