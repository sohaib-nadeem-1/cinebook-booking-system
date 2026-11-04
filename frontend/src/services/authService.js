import { api, ApiError } from "./api.js";

const KEYS = {
  customer: "session",
  admin: "adminSession",
};

// Normalize API response
const extractProfile = (response) => {
  const body = response?.data ?? response;

  const profile = body?.data ?? body?.user ?? body;

  if (!profile?.id || !profile?.email) {
    throw new ApiError(
      "Invalid user profile response",
      "PROFILE_NOT_FOUND"
    );
  }

  return profile;
};

const saveSession = (kind, token, user, remember = true) => {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem(
    KEYS[kind],
    JSON.stringify({
      token,
      user,
    })
  );

  localStorage.setItem("token", token);
};

export const readSession = (kind = "customer") => {
  const raw =
    localStorage.getItem(KEYS[kind]) ||
    sessionStorage.getItem(KEYS[kind]);

  if (!raw) return null;

  try {
    const session = JSON.parse(raw);

    return session.user || null;
  } catch {
    localStorage.removeItem(KEYS[kind]);
    sessionStorage.removeItem(KEYS[kind]);

    return null;
  }
};

export const authService = {
  login: async ({
    email,
    password,
    remember = true,
    portal = "customer",
  }) => {
    const response = await api.post("/login", {
      email,
      password,
    });

    const token = response?.token;

    if (!token) {
      throw new ApiError(
        "Token was not returned by server",
        "INVALID_RESPONSE"
      );
    }

    localStorage.setItem("token", token);

    const profileResponse = await api.get("/profile");

    const user = extractProfile(profileResponse);

    const role = user.role;

    const staffRoles = [
      "admin",
      "staff",
      "system_admin",
      "box_office",
      "Box Office Staff",
    ];

    const isStaff = staffRoles.includes(role);

    if (portal === "admin" && !isStaff) {
      localStorage.removeItem("token");

      throw new ApiError(
        "This account does not have access to the admin console.",
        "FORBIDDEN"
      );
    }

    if (portal === "customer" && isStaff) {
      localStorage.removeItem("token");

      throw new ApiError(
        "Staff accounts sign in through the Admin Portal.",
        "WRONG_PORTAL"
      );
    }

    saveSession(portal, token, user, remember);

    return user;
  },

  register: async ({
    name,
    email,
    phone,
    password,
  }) => {
    const response = await api.post("/register", {
      name,
      email,
      phone,
      password,
    });

    const token = response?.token;

    if (!token) {
      throw new ApiError(
        "Token was not returned by server",
        "INVALID_RESPONSE"
      );
    }

    localStorage.setItem("token", token);

    const profileResponse = await api.get("/profile");

    const user = extractProfile(profileResponse);

    saveSession("customer", token, user, true);

    return user;
  },

  getProfile: async () => {
    const response = await api.get("/profile");

    return extractProfile(response);
  },

  continueAsGuest: () => {
    const guest = {
      id: "guest",
      name: "Guest",
      role: "guest",
      guest: true,
    };

    sessionStorage.setItem(
      KEYS.customer,
      JSON.stringify({
        user: guest,
        token: null,
      })
    );

    return guest;
  },

  logout: (kind = "customer") => {
    localStorage.removeItem(KEYS[kind]);
    sessionStorage.removeItem(KEYS[kind]);

    localStorage.removeItem("token");
  },
};