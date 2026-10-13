import { encode } from "blurhash";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { nameKey } from "../src/lib/names";

const prisma = new PrismaClient();

const genres = ["драма", "комедия", "криминал", "мелодрама", "приключения", "военный"];

const actors = ["Анна Волгина", "Пётр Самойлов", "Мария Левина", "Игорь Кравец", "Ольга Нестерова", "Кирилл Дорохов"];
const directors = ["Елена Маркова", "Андрей Скворцов", "Нина Белова"];
const producers = ["Олег Рыбин", "Светлана Чудина"];

const movies = [
  { title: "Северный экспресс", poster: 1, genres: ["драма", "приключения"], actors: ["Пётр Самойлов", "Анна Волгина"], directors: ["Елена Маркова"], producers: ["Олег Рыбин"] },
  { title: "Тихий двор", poster: 2, genres: ["мелодрама"], actors: ["Мария Левина", "Ольга Нестерова"], directors: ["Нина Белова"], producers: ["Светлана Чудина"] },
  { title: "Последний сеанс", poster: 3, genres: ["драма"], actors: ["Игорь Кравец", "Анна Волгина"], directors: ["Андрей Скворцов"], producers: ["Олег Рыбин"] },
  { title: "Город без вывесок", poster: 4, genres: ["криминал", "драма"], actors: ["Кирилл Дорохов", "Пётр Самойлов"], directors: ["Елена Маркова"], producers: ["Светлана Чудина"] },
  { title: "Письмо на вокзал", poster: 5, genres: ["мелодрама", "драма"], actors: ["Ольга Нестерова", "Игорь Кравец"], directors: ["Нина Белова"], producers: ["Олег Рыбин"] },
  { title: "Ночной трамвай", poster: 6, genres: ["криминал"], actors: ["Кирилл Дорохов", "Мария Левина"], directors: ["Андрей Скворцов"], producers: ["Светлана Чудина"] },
  { title: "Дом у маяка", poster: 7, genres: ["приключения", "мелодрама"], actors: ["Анна Волгина", "Ольга Нестерова"], directors: ["Елена Маркова"], producers: ["Олег Рыбин"] },
  { title: "Чёрная перчатка", poster: 8, genres: ["криминал", "приключения"], actors: ["Пётр Самойлов", "Кирилл Дорохов"], directors: ["Андрей Скворцов"], producers: ["Светлана Чудина"] },
  { title: "Летний снег", poster: 9, genres: ["комедия", "мелодрама"], actors: ["Мария Левина", "Игорь Кравец"], directors: ["Нина Белова"], producers: ["Олег Рыбин"] },
  { title: "Ключ от чердака", poster: 10, genres: ["комедия"], actors: ["Ольга Нестерова", "Пётр Самойлов"], directors: ["Елена Маркова"], producers: ["Светлана Чудина"] },
  { title: "Три билета", poster: 11, genres: ["приключения", "комедия"], actors: ["Кирилл Дорохов", "Анна Волгина", "Мария Левина"], directors: ["Андрей Скворцов"], producers: ["Олег Рыбин"] },
  { title: "Река помнит", poster: 12, genres: ["драма", "военный"], actors: ["Игорь Кравец", "Пётр Самойлов", "Ольга Нестерова"], directors: ["Нина Белова"], producers: ["Светлана Чудина"] },
];

async function placeholderBlurhash() {
  const { data, info } = await sharp({
    create: {
      width: 36,
      height: 64,
      channels: 3,
      background: { r: 154, g: 52, b: 18 },
    },
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 5, 9);
}

async function upsertNamed(kind: "genre" | "actor" | "director" | "producer", name: string) {
  const data = { name, nameKey: nameKey(name) };
  if (kind === "genre") {
    return prisma.genre.upsert({ where: { nameKey: data.nameKey }, update: { name }, create: data });
  }
  if (kind === "actor") {
    return prisma.actor.upsert({ where: { nameKey: data.nameKey }, update: { name }, create: data });
  }
  if (kind === "director") {
    return prisma.director.upsert({ where: { nameKey: data.nameKey }, update: { name }, create: data });
  }
  return prisma.producer.upsert({ where: { nameKey: data.nameKey }, update: { name }, create: data });
}

async function main() {
  const posterBlurhash = await placeholderBlurhash();

  const genreByName = new Map<string, string>();
  for (const name of genres) genreByName.set(name, (await upsertNamed("genre", name)).id);

  const actorByName = new Map<string, string>();
  for (const name of actors) actorByName.set(name, (await upsertNamed("actor", name)).id);

  const directorByName = new Map<string, string>();
  for (const name of directors) directorByName.set(name, (await upsertNamed("director", name)).id);

  const producerByName = new Map<string, string>();
  for (const name of producers) producerByName.set(name, (await upsertNamed("producer", name)).id);

  for (const movie of movies) {
    const posterUrl = `https://placehold.co/400x600/png?text=Movie+${movie.poster}`;
    const saved = await prisma.movie.upsert({
      where: { title: movie.title },
      update: { posterUrl, posterBlurhash },
      create: { title: movie.title, posterUrl, posterBlurhash },
    });

    await prisma.movieGenre.deleteMany({ where: { movieId: saved.id } });
    await prisma.movieActor.deleteMany({ where: { movieId: saved.id } });
    await prisma.movieDirector.deleteMany({ where: { movieId: saved.id } });
    await prisma.movieProducer.deleteMany({ where: { movieId: saved.id } });

    await prisma.movieGenre.createMany({
      data: movie.genres.map((name) => ({ movieId: saved.id, genreId: genreByName.get(name)! })),
    });
    await prisma.movieActor.createMany({
      data: movie.actors.map((name) => ({ movieId: saved.id, actorId: actorByName.get(name)! })),
    });
    await prisma.movieDirector.createMany({
      data: movie.directors.map((name) => ({ movieId: saved.id, directorId: directorByName.get(name)! })),
    });
    await prisma.movieProducer.createMany({
      data: movie.producers.map((name) => ({ movieId: saved.id, producerId: producerByName.get(name)! })),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    await prisma.$disconnect();
    process.exit(1);
  });
