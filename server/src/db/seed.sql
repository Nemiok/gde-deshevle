-- ГдеДешевле — Seed Data
-- Run after schema.sql:
--   psql $DATABASE_URL -f src/db/seed.sql
--
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.

-- ─── Stores ───────────────────────────────────────────────────────────────────

INSERT INTO stores (name, slug, logo_url, website_url) VALUES
  ('Пятёрочка',   'pyaterochka',  NULL, 'https://5ka.ru'),
  ('Магнит',      'magnit',       NULL, 'https://magnit.ru'),
  ('Лента',       'lenta',        NULL, 'https://lenta.com'),
  ('Перекрёсток', 'perekrestok',  NULL, 'https://www.perekrestok.ru'),
  ('ВкусВилл',    'vkusvill',     NULL, 'https://vkusvill.ru')
ON CONFLICT (slug) DO NOTHING;

-- ─── Categories ───────────────────────────────────────────────────────────────

INSERT INTO categories (name, slug) VALUES
  ('Молочные продукты',     'dairy'),
  ('Хлеб и выпечка',        'bread'),
  ('Яйца',                  'eggs'),
  ('Бакалея',               'bakaleya'),
  ('Фрукты и овощи',        'fruits-vegetables'),
  ('Мясо и птица',          'meat-poultry'),
  ('Рыба и морепродукты',   'fish-seafood'),
  ('Напитки',               'drinks'),
  ('Замороженные продукты', 'frozen'),
  ('Кондитерские изделия',  'confectionery')
ON CONFLICT (slug) DO NOTHING;

-- ─── Products ─────────────────────────────────────────────────────────────────
-- 50 common grocery items for Saint Petersburg stores.

INSERT INTO products (name, unit, category_id)
SELECT v.name, v.unit, c.id
FROM (VALUES
  -- Dairy
  ('Молоко 3.2%',                         'л',   'dairy'),
  ('Молоко 2.5%',                         'л',   'dairy'),
  ('Кефир 3.2%',                          'л',   'dairy'),
  ('Творог 5%',                           'кг',  'dairy'),
  ('Сметана 20%',                         'кг',  'dairy'),
  ('Масло сливочное 82.5%',               'кг',  'dairy'),
  ('Йогурт натуральный',                  'кг',  'dairy'),
  ('Ряженка 4%',                          'л',   'dairy'),
  ('Сыр Российский',                      'кг',  'dairy'),
  ('Сыр Гауда',                           'кг',  'dairy'),

  -- Bread
  ('Хлеб белый нарезной',                 'шт',  'bread'),
  ('Хлеб чёрный Бородинский',             'шт',  'bread'),
  ('Батон нарезной',                      'шт',  'bread'),
  ('Хлеб цельнозерновой',                 'шт',  'bread'),
  ('Булочки для гамбургеров',             'уп',  'bread'),

  -- Eggs
  ('Яйца куриные С1',                     'уп',  'eggs'),
  ('Яйца куриные С0',                     'уп',  'eggs'),

  -- Bakaleya (dry goods / staples)
  ('Рис длиннозёрный пропаренный',        'кг',  'bakaleya'),
  ('Гречка ядрица',                       'кг',  'bakaleya'),
  ('Овсяные хлопья Геркулес',             'кг',  'bakaleya'),
  ('Макароны Спагетти',                   'кг',  'bakaleya'),
  ('Макароны Пенне',                      'кг',  'bakaleya'),
  ('Сахар-песок',                         'кг',  'bakaleya'),
  ('Соль поваренная',                     'кг',  'bakaleya'),
  ('Масло подсолнечное рафинированное',   'л',   'bakaleya'),
  ('Масло оливковое Extra Virgin',        'л',   'bakaleya'),
  ('Мука пшеничная в/с',                  'кг',  'bakaleya'),

  -- Fruits & vegetables
  ('Яблоки Голден',                       'кг',  'fruits-vegetables'),
  ('Бананы',                              'кг',  'fruits-vegetables'),
  ('Помидоры',                            'кг',  'fruits-vegetables'),
  ('Огурцы',                              'кг',  'fruits-vegetables'),
  ('Картофель',                           'кг',  'fruits-vegetables'),
  ('Морковь',                             'кг',  'fruits-vegetables'),
  ('Лук репчатый',                        'кг',  'fruits-vegetables'),
  ('Капуста белокочанная',                'кг',  'fruits-vegetables'),

  -- Meat
  ('Куриное филе',                        'кг',  'meat-poultry'),
  ('Куриные бёдра',                       'кг',  'meat-poultry'),
  ('Свинина (шея)',                       'кг',  'meat-poultry'),
  ('Фарш говяжий',                        'кг',  'meat-poultry'),

  -- Fish
  ('Сёмга с/с',                           'кг',  'fish-seafood'),
  ('Минтай мороженый',                    'кг',  'fish-seafood'),
  ('Сельдь солёная',                      'кг',  'fish-seafood'),

  -- Drinks
  ('Вода питьевая негазированная 1.5 л',  'шт',  'drinks'),
  ('Сок апельсиновый 1 л',               'шт',  'drinks'),
  ('Кофе молотый',                        'кг',  'drinks'),
  ('Чай чёрный листовой',                 'кг',  'drinks'),

  -- Frozen
  ('Пельмени',                            'кг',  'frozen'),
  ('Мороженое пломбир',                   'кг',  'frozen'),

  -- Confectionery
  ('Шоколад тёмный 70%',                  'шт',  'confectionery'),
  ('Печенье овсяное',                     'кг',  'confectionery')
) AS v(name, unit, cat_slug)
JOIN categories c ON c.slug = v.cat_slug
ON CONFLICT DO NOTHING;

-- ─── Product aliases ──────────────────────────────────────────────────────────
-- Common alternative names that scrapers might encounter.

INSERT INTO product_aliases (product_id, alias)
SELECT p.id, a.alias
FROM (
  VALUES
    -- Milk
    ('Молоко 3.2%',   'Молоко цельное 3.2%'),
    ('Молоко 3.2%',   'Молоко пастеризованное 3.2%'),
    ('Молоко 2.5%',   'Молоко пастеризованное 2.5%'),
    -- Eggs
    ('Яйца куриные С1',  'Яйца С1 10шт'),
    ('Яйца куриные С1',  'Яйцо куриное С1'),
    ('Яйца куриные С0',  'Яйца отборные С0'),
    -- Butter
    ('Масло сливочное 82.5%', 'Масло крестьянское'),
    ('Масло сливочное 82.5%', 'Масло традиционное 82.5%'),
    -- Bread
    ('Хлеб белый нарезной', 'Хлеб пшеничный нарезной'),
    ('Хлеб чёрный Бородинский', 'Хлеб Бородинский'),
    -- Meat
    ('Куриное филе', 'Филе куриное охлаждённое'),
    ('Куриное филе', 'Грудка куриная'),
    ('Фарш говяжий', 'Фарш говядина'),
    -- Fish
    ('Сёмга с/с', 'Лосось слабосолёный'),
    ('Сёмга с/с', 'Сёмга слабосолёная'),
    -- Drinks
    ('Кофе молотый', 'Кофе натуральный молотый'),
    ('Чай чёрный листовой', 'Чай чёрный крупнолистовой')
) AS a(product_name, alias)
JOIN products p ON p.name = a.product_name
ON CONFLICT DO NOTHING;
