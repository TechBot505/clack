import type { Metadata } from "next";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = { title: "profile" };

export default function ProfilePage() {
  return <ProfileClient />;
}
