# Règles de gestion

Synthèse des règles numérotées du cahier des charges (section 3), destinée à être référencée dans le code, les tickets et les tests. Toute évolution de l'une d'elles est une décision de gestion, pas un ajustement technique — se référer à la section 3 du [cahier des charges](cahier-des-charges-livraison-burkina.pdf) pour le détail complet.

## 3.1 Tarification

- **RG-01** — Le tarif d'une course est déterminé exclusivement par le couple (zone de retrait, zone de livraison) dans la version active de la grille tarifaire.
- **RG-02** — Le tarif est figé au moment de la publication de la course. Une révision ultérieure de la grille n'affecte pas les courses déjà publiées.
- **RG-03** — Aucun acteur ne peut saisir ou modifier le tarif d'une course.
- **RG-04** — Le tarif affiché est le montant dû par le destinataire au titre du transport. Il s'impose au livreur qui accepte la course.
- **RG-05** — Une grille tarifaire est versionnée. Une nouvelle version possède une date de prise d'effet ; une seule version est active à un instant donné.

## 3.2 Prélèvement et frais de notification

- **RG-06** — Le prélèvement est égal à 10 % du tarif de transport, arrondi au franc supérieur, plafonné à 500 FCFA.
- **RG-07** — Le prélèvement ne porte jamais sur la valeur de la marchandise ni sur les suppléments.
- **RG-08** — Un frais de notification de 15 FCFA est débité pour chaque SMS envoyé au destinataire. Il s'ajoute au prélèvement et ne s'y substitue pas.
- **RG-09** — Le frais de notification n'est pas soumis au plafond de 500 FCFA : c'est un coût répercuté, pas une commission.
- **RG-10** — La déclaration d'un supplément déclenche un second SMS et donc un second frais de notification, débité au livreur qui l'a déclaré.
- **RG-11** — Si l'agrégateur signale que le SMS n'a pas été remis, le frais correspondant est recrédité automatiquement et immédiatement.
- **RG-12** — Le montant débité à l'acceptation est la somme du prélèvement et du frais de notification. Les deux composantes sont affichées séparément au livreur avant qu'il confirme.

## 3.3 Portefeuille, découvert et recharge

- **RG-13** — Le débit total est prélevé du solde du livreur au moment où il accepte la course, dans la même transaction que l'acceptation.
- **RG-14** — Un livreur dont le solde couvre le débit accepte normalement. Un livreur dont le solde est insuffisant peut néanmoins accepter une course en découvert, aux conditions ci-dessous.
- **RG-15** — Le découvert exige un solde strictement positif au moment de l'acceptation. Un solde nul ou négatif interdit toute nouvelle course.
- **RG-16** — Une seule course peut être prise en découvert. Le solde devient négatif du montant exactement manquant, et aucune autre course n'est accessible tant qu'il n'est pas revenu positif.
- **RG-17** — Le montant du découvert ne peut excéder le débit de la course concernée. L'exposition maximale de la plateforme par compte est donc d'un seul débit.
- **RG-18** — La dette est apurée automatiquement lors de la recharge suivante, sans démarche du livreur. Le solde affiché après recharge est net de la dette.
- **RG-19** — Le passage en découvert est annoncé explicitement avant confirmation : le livreur voit le montant qui restera à régler.
- **RG-20** — La recharge minimale est de 500 FCFA. Aucun retrait de crédit vers un compte mobile money n'est possible : le crédit est consommable, non remboursable en argent.
- **RG-21** — Tout mouvement de crédit est enregistré dans un journal immuable : aucune modification directe du solde n'est autorisée, le solde est la somme des mouvements.

## 3.4 Cycle de vie d'une course

- **RG-22** — Une course publiée est proposée simultanément à tous les livreurs actifs éligibles au sens de RG-14 à RG-16. Le premier qui accepte obtient la course.
- **RG-23** — L'acceptation est atomique : deux livreurs ne peuvent jamais obtenir la même course, et un livreur ne peut jamais être débité pour une course qu'il n'a pas obtenue.
- **RG-24** — Un livreur ne peut détenir qu'une seule course en cours à la fois en version 1.
- **RG-25** — Une course est clôturée par la saisie, par le livreur, du code de retrait communiqué par le destinataire.
- **RG-26** — Le code de retrait est généré à l'acceptation, comporte quatre chiffres, et est transmis au destinataire par SMS.
- **RG-27** — Une course non clôturée dans les 24 heures suivant son acceptation passe automatiquement en état « à vérifier » et remonte au back-office.

## 3.5 Annulation et recrédit

- **RG-28** — Une course peut être annulée par l'expéditeur avant acceptation, sans conséquence.
- **RG-29** — Après acceptation, une course peut être déclarée échouée par le livreur avec un motif obligatoire, ou annulée par l'expéditeur.
- **RG-30** — Toute course acceptée puis non réalisée donne lieu au recrédit intégral du prélèvement, sans démarche du livreur.
- **RG-31** — Le frais de notification n'est pas recrédité lorsque le SMS a bien été remis : le service a été rendu, même si la course a échoué ensuite.
- **RG-32** — Le recrédit du prélèvement est différé de 72 heures à compter de la déclaration d'échec. Le montant apparaît dans le portefeuille en attente avec sa date de disponibilité.
- **RG-33** — Un recrédit en attente n'entre pas dans le solde disponible et ne permet donc pas d'accepter une course ni d'apurer un découvert avant son échéance.
- **RG-34** — Au-delà d'un seuil d'échecs déclarés sur une période glissante, le compte du livreur est signalé au back-office pour examen. Seuil à fixer (point ouvert).

## 3.6 Paiement à la livraison

- **RG-35** — L'expéditeur peut indiquer un montant de marchandise à encaisser auprès du destinataire. Ce montant est saisi librement par l'expéditeur.
- **RG-36** — Le montant total annoncé au destinataire est la somme du tarif de transport, de la marchandise le cas échéant, et des suppléments validés.
- **RG-37** — La plateforme n'est pas partie au reversement de la marchandise. Elle enregistre le montant, l'affiche, mais ne garantit ni ne contrôle sa remise à l'expéditeur.
- **RG-38** — L'expéditeur confirme ou conteste la réception de la somme dans l'application. Une contestation crée un signalement.

## 3.7 Suppléments

- **RG-39** — Un livreur peut déclarer un supplément pendant la course, parmi une liste fermée de motifs, avec un montant issu d'un barème.
- **RG-40** — Un supplément déclaré est notifié au destinataire par SMS et à l'expéditeur dans l'application avant la remise du colis.
- **RG-41** — Les suppléments ne sont pas soumis au prélèvement de la plateforme, mais déclenchent un frais de notification au titre de RG-10.

## 3.8 Notation et réputation

- **RG-42** — Seul l'expéditeur note le livreur, une fois la course clôturée, sur une échelle de 1 à 5.
- **RG-43** — La note moyenne n'est affichée qu'à partir de cinq notations reçues. En deçà, seul le compteur de livraisons est affiché.
- **RG-44** — Le compteur de livraisons n'incrémente que sur les courses clôturées par code de retrait.
- **RG-45** — La note et le compteur sont visibles de l'expéditeur dès qu'un livreur accepte sa course.

## 3.9 Signalements et suspension

- **RG-46** — Un signalement peut être créé par l'expéditeur dans l'application, ou par le destinataire par réponse au SMS.
- **RG-47** — Un signalement pour non-reversement de marchandise entraîne la suspension immédiate du livreur, avant instruction.
- **RG-48** — Un livreur suspendu ne reçoit plus de courses et ne peut plus recharger. Son solde reste acquis et n'est pas remboursé.
- **RG-49** — Toute suspension et toute levée de suspension sont journalisées avec leur auteur et leur motif.
