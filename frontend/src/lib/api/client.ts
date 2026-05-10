import ky from "ky";

export const apiClient = ky.create({
  prefix: "/api/v1",
  timeout: 15_000,
});
