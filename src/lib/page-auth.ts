import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export async function getPageUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
