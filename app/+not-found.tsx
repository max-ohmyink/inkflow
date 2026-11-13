import { Redirect } from "expo-router";

// Unknown URLs go back to the studio instead of a dead end.
export default function NotFound() {
  return <Redirect href="/" />;
}
