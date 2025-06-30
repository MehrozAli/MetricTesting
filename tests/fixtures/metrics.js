// Demo metric records shaped like the Qdrant payloads the app reads.
export const VOCABULARY = { "created leads": 0, created: 1, leads: 2, tours: 3 };

export const createdLeads = {
  id: 11,
  score: 0.92,
  payload: {
    UID: "MET-001",
    "Business Name": "Created Leads",
    m_Definition: "New prospects entered into the CRM during the period.",
    m_Calculation: "Count of lead records with a created date in the period.",
    "m_Recorded By": "Leasing agents and web forms",
    "m_They Come Through": "Website, phone, walk-in",
    Importance: "Top-of-funnel demand signal.",
    "Value Type": "Count",
  },
};

export const tours = {
  id: 12,
  score: 0.41,
  payload: {
    UID: "MET-002",
    "Business Name": "Tours",
    Definition: "Property visits completed by a prospect.",
    Calculations: "Count of completed tour appointments.",
  },
};
