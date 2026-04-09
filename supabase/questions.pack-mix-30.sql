begin;

insert into public.questions (
  id,
  difficulty,
  prompt,
  answer,
  accepted_answers,
  metadata,
  is_active
)
values
  ('fac-001', 'easy', 'Quel réalisateur a dirigé le film "Parasite", Palme d''Or 2019 ?', 'Bong Joon-ho', jsonb_build_array('Bong Joon-ho', 'Bong Joon ho'), jsonb_build_object('answerMode', 'text'), true),
  ('fac-002', 'easy', 'Dans quel film d''Hitchcock un photographe immobilisé espionne-t-il ses voisins ?', 'Fenêtre sur cour', jsonb_build_array('Fenêtre sur cour', 'Rear Window'), jsonb_build_object('answerMode', 'text'), true),
  ('fac-003', 'easy', 'Quel est le nom du célèbre petit vagabond interprété par Charlie Chaplin ?', 'Charlot', jsonb_build_array('Charlot', 'The Tramp'), jsonb_build_object('answerMode', 'text'), true),
  ('fac-004', 'easy', 'Quel réalisateur américain est connu pour son style symétrique et ses couleurs pastels (The Grand Budapest Hotel) ?', 'Wes Anderson', jsonb_build_array('Wes Anderson'), jsonb_build_object('answerMode', 'text'), true),
  ('fac-005', 'easy', 'Dans "Inception", quel objet Cobb utilise-t-il comme totem pour savoir s''il rêve ?', 'Une toupie', jsonb_build_array('Une toupie', 'Totem'), jsonb_build_object('answerMode', 'text'), true),

  ('fac-qcm-001', 'easy', 'Qui a réalisé "Pulp Fiction" ?', 'Quentin Tarantino', jsonb_build_array('Quentin Tarantino'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Martin Scorsese', 'Steven Spielberg', 'David Fincher')), true),
  ('fac-qcm-002', 'easy', 'Quel film raconte l''histoire d''une doublure de film et d''un acteur sur le déclin en 1969 à Hollywood ?', 'Once Upon a Time in Hollywood', jsonb_build_array('Once Upon a Time in Hollywood'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('La La Land', 'Babylon', 'The Artist')), true),
  ('fac-qcm-003', 'easy', 'Dans quel film d''animation suit-on un voyage onirique dans un bain public pour esprits ?', 'Le Voyage de Chihiro', jsonb_build_array('Le Voyage de Chihiro'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Mon Voisin Totoro', 'Princesse Mononoké', 'Ponyo sur la falaise')), true),
  ('fac-qcm-004', 'easy', 'Quel acteur incarne le Joker dans "The Dark Knight" (2008) ?', 'Heath Ledger', jsonb_build_array('Heath Ledger'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Joaquin Phoenix', 'Jack Nicholson', 'Jared Leto')), true),
  ('fac-qcm-005', 'easy', 'Quelle ville est le décor principal du film "La Haine" ?', 'Paris (Chanteloup-les-Vignes)', jsonb_build_array('Paris'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Marseille', 'Lyon', 'Lille')), true),

  ('moy-001', 'medium', 'Quel film de 1966 d''Antonioni traite d''un photographe qui croit avoir filmé un meurtre ?', 'Blow-Up', jsonb_build_array('Blow-Up', 'Blow up'), jsonb_build_object('answerMode', 'text'), true),
  ('moy-002', 'medium', 'Quel cinéaste a réalisé la "Trilogie d''Apu" ?', 'Satyajit Ray', jsonb_build_array('Satyajit Ray'), jsonb_build_object('answerMode', 'text'), true),
  ('moy-003', 'medium', 'Dans "Shining", quel est le nom de l''hôtel hanté ?', 'Overlook Hotel', jsonb_build_array('Overlook', 'Overlook Hotel'), jsonb_build_object('answerMode', 'text'), true),
  ('moy-004', 'medium', 'Quel réalisateur italien est l''auteur de "Huit et demi" (8½) ?', 'Federico Fellini', jsonb_build_array('Federico Fellini', 'Fellini'), jsonb_build_object('answerMode', 'text'), true),
  ('moy-005', 'medium', 'Quel film de David Lynch commence par la découverte d''une oreille coupée dans un champ ?', 'Blue Velvet', jsonb_build_array('Blue Velvet'), jsonb_build_object('answerMode', 'text'), true),

  ('moy-qcm-001', 'medium', 'Quel film de Fritz Lang de 1927 est considéré comme le chef-d''œuvre de la SF expressionniste ?', 'Metropolis', jsonb_build_array('Metropolis'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('M le Maudit', 'Le Cabinet du Dr Caligari', 'Nosferatu')), true),
  ('moy-qcm-002', 'medium', 'Dans "The Lobster", que deviennent les humains s''ils ne trouvent pas l''âme sœur ?', 'Des animaux', jsonb_build_array('Des animaux'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Des esclaves', 'Des arbres', 'Des pierres')), true),
  ('moy-qcm-003', 'medium', 'Quel film de Kurosawa raconte un même crime à travers quatre points de vue différents ?', 'Rashōmon', jsonb_build_array('Rashomon'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Les Sept Samouraïs', 'Ran', 'Yojimbo')), true),
  ('moy-qcm-004', 'medium', 'Quel cinéaste danois a lancé le mouvement "Dogme 95" ?', 'Lars von Trier', jsonb_build_array('Lars von Trier'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Thomas Vinterberg', 'Mads Mikkelsen', 'Nicolas Winding Refn')), true),
  ('moy-qcm-005', 'medium', 'Quel film de Tarkovski se déroule sur une station spatiale face à un océan pensant ?', 'Solaris', jsonb_build_array('Solaris'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Stalker', 'Le Sacrifice', 'Nostalghia')), true),

  ('dif-001', 'hard', 'Quel réalisateur a filmé "L''Avventura" (1960), où la disparition d''un personnage n''est jamais résolue ?', 'Michelangelo Antonioni', jsonb_build_array('Antonioni', 'Michelangelo Antonioni'), jsonb_build_object('answerMode', 'text'), true),
  ('dif-002', 'hard', 'Quel film expérimental de 1974 de Chantal Akerman dure 3h20 et montre des tâches ménagères en temps réel ?', 'Jeanne Dielman, 23, quai du Commerce, 1080 Bruxelles', jsonb_build_array('Jeanne Dielman'), jsonb_build_object('answerMode', 'text'), true),
  ('dif-003', 'hard', 'Qui a réalisé "Le Miroir" (1975), film autobiographique et fragmentaire russe ?', 'Andrei Tarkovski', jsonb_build_array('Tarkovski', 'Tarkovsky'), jsonb_build_object('answerMode', 'text'), true),
  ('dif-004', 'hard', 'Quel cinéaste est connu pour ses plans-séquences de 10 minutes dans "Sátántangó" ?', 'Béla Tarr', jsonb_build_array('Béla Tarr', 'Bela Tarr'), jsonb_build_object('answerMode', 'text'), true),
  ('dif-005', 'hard', 'Quel film de 1973 de Jodorowsky a été financé en partie par John Lennon ?', 'La Montagne sacrée', jsonb_build_array('La Montagne sacrée', 'The Holy Mountain'), jsonb_build_object('answerMode', 'text'), true),

  ('dif-qcm-001', 'hard', 'Quel réalisateur géorgien a conçu "La Couleur de la grenade" ?', 'Sergueï Paradjanov', jsonb_build_array('Paradjanov'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Otar Iosseliani', 'Elem Klimov', 'Tenguiz Abouladzé')), true),
  ('dif-qcm-002', 'hard', 'Dans "Possession" (1981), quelle actrice livre une performance extrême dans une scène de métro ?', 'Isabelle Adjani', jsonb_build_array('Isabelle Adjani'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Catherine Deneuve', 'Juliette Binoche', 'Béatrice Dalle')), true),
  ('dif-qcm-003', 'hard', 'Quel est le premier long-métrage de David Lynch, tourné en noir et blanc industriel ?', 'Eraserhead', jsonb_build_array('Eraserhead'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Elephant Man', 'Dune', 'Wild at Heart')), true),
  ('dif-qcm-004', 'hard', 'Quel film de Straub-Huillet est une adaptation d''un opéra inachevé de Schoenberg ?', 'Moïse et Aaron', jsonb_build_array('Moïse et Aaron'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Othon', 'Antigone', 'Sicilia!')), true),
  ('dif-qcm-005', 'hard', 'Quel cinéaste a réalisé "Tropical Malady", film scindé en deux parties (romance et traque mystique) ?', 'Apichatpong Weerasethakul', jsonb_build_array('Apichatpong Weerasethakul'), jsonb_build_object('answerMode', 'mcq', 'distractors', jsonb_build_array('Hou Hsiao-hsien', 'Tsai Ming-liang', 'Edward Yang')), true)
on conflict (id) do update set
  difficulty = excluded.difficulty,
  prompt = excluded.prompt,
  answer = excluded.answer,
  accepted_answers = excluded.accepted_answers,
  metadata = excluded.metadata,
  is_active = excluded.is_active;

commit;
