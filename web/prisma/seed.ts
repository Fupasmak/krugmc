import { PrismaClient } from '@prisma/client';

/**
 * Начальные данные. Запускается сколько угодно раз: ничего не дублирует
 * и не перезаписывает то, что уже правил админ.
 * Выдуманных игроков и завозов здесь нет, только настройки и первая неделя.
 */
const prisma = new PrismaClient();

async function main() {
  const existingSettings = await prisma.siteSetting.findUnique({ where: { key: 'site' } });
  if (!existingSettings) {
    await prisma.siteSetting.create({
      data: {
        key: 'site',
        value: {
          projectStatus: 'DEVELOPMENT',
          projectStatusNote: 'Готовим Zero Season. Набор скоро.',
          trailerUrl: '',
          trailerTitle: 'Трейлер KRUG',
          heroTagline: 'Создаём круг там, где квадрат',
          joinOpen: false,
        },
      },
    });
    console.log('• настройки сайта созданы');
  } else {
    console.log('• настройки сайта уже есть, не трогаю');
  }

  const week = await prisma.archiveWeek.findUnique({ where: { number: 1 } });
  if (!week) {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 0);

    await prisma.archiveWeek.create({
      data: {
        number: 1,
        title: 'Неделя 1',
        summary: 'Первая неделя архива. Пункты добавляются из админки.',
        startsAt: monday,
        endsAt: sunday,
        published: false,
      },
    });
    console.log('• создана первая неделя архива (черновик)');
  } else {
    console.log('• неделя 1 уже есть');
  }

  console.log('Готово.');
}

main()
  .catch((error) => {
    console.error('Сид не отработал:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
