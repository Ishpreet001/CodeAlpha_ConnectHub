import { count } from "drizzle-orm";
import { db, postsTable, usersTable, followsTable } from "@workspace/db";
import { hashPassword } from "./middlewares/auth";

export async function seedDemoData() {
  const existing = await db.select({ value: count() }).from(usersTable);
  if (Number(existing[0]?.value ?? 0) > 0) return;

  const demoPassword = await hashPassword("DemoPass123!");
  const created = await db
    .insert(usersTable)
    .values([
      {
        name: "Maya Chen",
        username: "maya",
        email: "maya@connecthub.demo",
        passwordHash: demoPassword,
        bio: "Designing tiny moments that make campus life feel more connected.",
      },
      {
        name: "Jordan Ellis",
        username: "jordan",
        email: "jordan@connecthub.demo",
        passwordHash: demoPassword,
        bio: "Computer science student, community builder, and weekend photographer.",
      },
      {
        name: "Aarav Mehta",
        username: "aarav",
        email: "aarav@connecthub.demo",
        passwordHash: demoPassword,
        bio: "Making room for better conversations.",
      },
    ])
    .returning();

  const maya = created.find((user) => user.username === "maya")!;
  const jordan = created.find((user) => user.username === "jordan")!;
  const aarav = created.find((user) => user.username === "aarav")!;

  await db.insert(followsTable).values([
    { followerId: jordan.id, followingId: maya.id },
    { followerId: aarav.id, followingId: maya.id },
    { followerId: maya.id, followingId: jordan.id },
  ]);

  await db.insert(postsTable).values([
    {
      authorId: maya.id,
      content: "A small reminder for this week: the best communities are built one thoughtful hello at a time.",
    },
    {
      authorId: jordan.id,
      content: "Found a quiet corner of the library with the most perfect afternoon light. Sharing the coordinates with the group.",
    },
    {
      authorId: aarav.id,
      content: "What is one thing you are learning outside your classes right now? I am collecting ideas for our next community night.",
    },
    {
      authorId: maya.id,
      content: "The campus garden is finally in bloom. If you need a reset between lectures, this is your sign.",
    },
  ]);
}