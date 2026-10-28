export const revalidate = 60;

export default function Home() {
  return <p>ISR page rendered at {new Date().toISOString()}</p>;
}
