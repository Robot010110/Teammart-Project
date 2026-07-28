// Mock data for TEAMMART — replace with real API calls when backend is ready.
// Shape is intentionally flat/simple so it maps 1:1 onto a future REST/GraphQL response.

export const currentUser = {
  name: "Rawand Salih",
  role: "Regional Supervisor",
  avatarInitials: "RS",
};

export const zones = [
  {
    id: "zone-1",
    number: 1,
    manager: "Ali Hassan",
    marketsCount: 3,
    employeesCount: 30,
    markets: [
      { id: "qushtapa-1", name: "Qushtapa 1", employees: 10, status: "Active" },
      { id: "qushtapa-2", name: "Qushtapa 2", employees: 10, status: "Active" },
      { id: "zhyan-1", name: "Zhyan 1", employees: 10, status: "Active" },
    ],
  },
  {
    id: "zone-2",
    number: 2,
    manager: "Ahmed Kareem",
    marketsCount: 5,
    employeesCount: 50,
    markets: [
      { id: "italyan-1", name: "Italyan 1", employees: 10, status: "Active" },
      { id: "italyan-2", name: "Italyan 2", employees: 10, status: "Active" },
      { id: "royal-1", name: "Royal 1", employees: 10, status: "Maintenance" },
      { id: "royal-2", name: "Royal 2", employees: 10, status: "Active" },
      { id: "sami-1", name: "Sami 1", employees: 10, status: "Active" },
    ],
  },
  {
    id: "zone-3",
    number: 3,
    manager: "Mohammed Ali",
    marketsCount: 4,
    employeesCount: 40,
    markets: [
      { id: "dream-city-1", name: "Dream City 1", employees: 10, status: "Active" },
      { id: "dream-city-2", name: "Dream City 2", employees: 10, status: "Active" },
      { id: "empire-1", name: "Empire 1", employees: 10, status: "Closed" },
      { id: "empire-2", name: "Empire 2", employees: 10, status: "Active" },
    ],
  },
];

export const getZoneById = (id) => zones.find((z) => z.id === id);
