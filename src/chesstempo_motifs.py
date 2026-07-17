from __future__ import annotations

# Generated from simple CHESSTEMPO ONLY motifs.xlsx.
# Keep this module dependency-free so the Streamlit app does not need openpyxl at runtime.

CHESSTEMPO_MOTIFS = [{'id': 'non_promotion_advanced_pawn',
  'name': 'Non-Promotion Advanced Pawn',
  'family': 'Advanced Pawn',
  'definition': 'A tag used when an advanced pawn contributes to a tactic without promoting or threatening '
                'promotion.An advanced pawn can also harass the king at his home without promoting or threatening '
                'promotion by supporting attacking pieces, controlling escape squares, being part of a demolition of '
                'pawn structures and being an essential part of attacks on the king in the middle game that either '
                'achieve mate or result in gain of material.'},
 {'id': 'promotion',
  'name': 'Promotion',
  'family': 'Advanced Pawn',
  'definition': 'A tag used when the position requires a promotion for tactical reasons. An advanced pawn can achieve '
                'a gain of material or mate by being promoted or by forcing the adversary to sacrifice a piece in '
                'order to capture the newly promoted queen.'},
 {'id': 'underpromotion',
  'name': 'Underpromotion',
  'family': 'Promotion',
  'definition': 'A tag used when the position requires an underpromotion for tactical reasons. Often the '
                'underpromotion is done to avoid stalemate, but other reasons are possible, such as providing a check '
                'or checkmate from a knight that a queen promotion was not able to deliver (perhaps as a fork). By far '
                'the most common tactical underpromotions will be to knight.'},
 {'id': 'promotion_threat',
  'name': 'Promotion Threat',
  'family': 'Advanced Pawn',
  'definition': 'A tag used when the advanced pawn threatens a promotion, without actually being promoted.A threat of '
                'promotion is often seen at the heart of tactical possibilities, as the resources required to prevent '
                'the promotion are not available to help elsewhere on the board. A threat of promotion also can force '
                'the adversary to sacrifice a piece in order to avoid the promotion.'},
 {'id': 'underpromotion_threat',
  'name': 'Underpromotion Threat',
  'family': 'Promotion Threat',
  'definition': 'A tag used when an underpromotion is threatened, but not actually made and the threat influences the '
                'outcome of the tactic.'},
 {'id': 'attraction',
  'name': 'Attraction',
  'family': 'Non-mate Motifs',
  'definition': 'Attraction occurs when a player entices a piece to a square (often using an active, but not a passive '
                'sacrifice) where it will later come under attack. This can sometimes also be called a Decoy tactic, '
                'although some users apply that to luring a piece AWAY from a square instead of towards one. One way '
                'of looking at the difference between coercion and attraction is that coercion pushes a piece to a '
                'square (usually via a direct attack), whereas attraction pulls a piece to a square, usually in order '
                'to take an actively sacrificed attacker. Note, if a piece is attracted to a square to remove it from '
                'defensive duties elsewhere, this is more likely to warrant a luring the defender tag, rather than an '
                'attraction tag.'},
 {'id': 'avoiding_perpetual',
  'name': 'Avoiding Perpetual',
  'family': 'Non-mate Motifs',
  'definition': 'A tactical line where the correct move sequence prevents the opponent from giving perpetual check.'},
 {'id': 'avoiding_stalemate',
  'name': 'Avoiding Stalemate',
  'family': 'Non-mate Motifs',
  'definition': 'A tactical line where the correct move sequence requires you to avoid stalemating the opponent king.'},
 {'id': 'blocking',
  'name': 'Blocking',
  'family': 'Non-mate Motifs',
  'definition': 'Blocking occurs when a player forces the movement of one adversary piece to a square in order to stop '
                'the previously available escape of another adversary piece to that square. Blocking is frequently '
                'achieved by the means of a sacrifice, attracting a piece onto the square to be blocked. The '
                'difference between blocking and interference is that interference blocks the defensive contact of two '
                'enemy pieces and blocking tactics blocks the previously available escape path of a piece. Blocking '
                'should also not be confused with defensive interposition. Blocking is about blocking escape paths, '
                'NOT blocking an attack on your own pieces, and the latter should be tagged as defensive '
                'interposition.'},
 {'id': 'diagonal_clearance',
  'name': 'Diagonal Clearance',
  'family': 'Clearance',
  'definition': 'A player forces a piece away from a diagonal (often using a sacrifice) to make way for another piece '
                'to utilise or attack the cleared diagonal. Note that clearances where the player clears a piece to '
                'make way for a piece behind it to attack another square or piece is sometimes referred to as '
                'clearance, however on ChessTempo these should be considered discovered attacks.'},
 {'id': 'file_clearance',
  'name': 'File Clearance',
  'family': 'Clearance',
  'definition': 'A player forces a piece away from a file (often using a sacrifice) to make way for another piece to '
                'utilise or attack the cleared file. Note that clearances where the player clears a piece to make way '
                'for a piece behind it to attack another square or piece is sometimes referred to as clearance, '
                'however on ChessTempo these should be considered discovered attacks.'},
 {'id': 'rank_clearance',
  'name': 'Rank Clearance',
  'family': 'Clearance',
  'definition': 'A player forces a piece away from a rank (often using a sacrifice) to make way for another piece to '
                'utilise or attack the cleared rank. Note that clearances where the player clears a piece to make way '
                'for a piece behind it to attack another square or piece is sometimes referred to as clearance, '
                'however on Chess Tempo these should be considered discovered attacks.'},
 {'id': 'square_clearance',
  'name': 'Square Clearance',
  'family': 'Clearance',
  'definition': 'A player moves one of their own pieces to clear a square for another of their pieces to utilise.'},
 {'id': 'coercion',
  'name': 'Coercion',
  'family': 'Non-mate Motifs',
  'definition': 'Coercion occurs when a player forces a piece to a square where it will later come under attack. This '
                'tag is designed to differentiate two situations where the attraction tag has been applied in the '
                'past. The Attraction tag is to be used where the piece is attracted to a square via an active '
                'sacrifice. The Coercion tag is to be used when the piece is forced to the square without an active '
                'sacrifice or when the piece has been coerced to accept a passive sacrifice. One way of looking at the '
                'difference between coercion and attraction is that coercion pushes a piece to a square (usually via a '
                'direct attack), whereas attraction pulls a piece to a square, usually in order to take an actively '
                'sacrificed attacker.'},
 {'id': 'controlling_escape_square',
  'name': 'Controlling Escape Square',
  'family': 'Non-mate Motifs',
  'definition': 'A move that controls the escape square(s) for an enemy piece, making it vulnerable to attack. The '
                'idea is most common in mating sequences, but may also appear in other situations, such as a trapped '
                'piece. While the move to control the escape square may be a quiet move leading up to an attack, it is '
                'also possible for the move preventing escape and the attack to come with the same move.'},
 {'id': 'counter_check',
  'name': 'Counter Check',
  'family': 'Non-mate Motifs',
  'definition': 'A counter check (sometimes called cross-check) occurs when a move makes a defensive interposition '
                "against a check on the player's king, and at the same time creates a new check against the opponent "
                'king. The check against the opponent king is often a discovery, but the interposing piece could also '
                'provide the check. It is acceptable to tag the discovery counter checks as both counter check AND '
                'discovered check and the defensive interposition counter check as both counter check AND defensive '
                'interposition.'},
 {'id': 'multi_square_counting',
  'name': 'Multi-square Counting',
  'family': 'Counting',
  'definition': 'Multi-square counting is similar to the under-protected piece motif, but applies when a sequence of '
                'captures is occurring across more than one square on the board. It applies when it is possible to '
                'force material gain only through a series of captures and recaptures on more than one square on the '
                'board, without using other tactical themes (other than Zwischenzug). This is a subset of the general '
                'technique of counting, and should be used when the only activity is material being exchanged on '
                "multiple squares (see also 'Under-protected Piece' which is the single square variation of this "
                'motif). It is not intended to be used when other tactical motifs are involved, with the exception of '
                'a Zwischenzug, and tagging both is fine.'},
 {'id': 'under_protected_piece',
  'name': 'Under-protected Piece',
  'family': 'Counting',
  'definition': 'An Under-protected Piece is a tactical motif that is present on the board whenever it is possible to '
                'force material gain only through a series of captures and recaptures on the same square, without '
                'using other tactical themes. This motif occurs when you have more attacks on an opponent piece than '
                'its defenses and there is a sequence of takes and retakes in which, at every take, the sum of the '
                'value of the piece you capture and the value of its defender is of equal or higher value than the '
                'piece that the opponent will recapture. This is a subset of the general idea of counting, and should '
                'be used when the only activity is material being exchanged on the same square (see also the '
                'multi-square counting). It is not intended to be used when other tactical motifs are involved.'},
 {'id': 'achieving_perpetual',
  'name': 'Achieving Perpetual',
  'family': 'Defensive Move',
  'definition': 'You have a bad position and must play for a draw by perpetual.'},
 {'id': 'avoiding_mate',
  'name': 'Avoiding Mate',
  'family': 'Defensive Move',
  'definition': 'The opponent is threatening mate and you must play to avoid the mate threat. Most commonly used in '
                'purely defensive problems, but these positions may also occur at the end of a tactical sequence where '
                'you have won material and must play a defensive move to avoid mate.'},
 {'id': 'defensive_interposition',
  'name': 'Defensive Interposition',
  'family': 'Defensive Move',
  'definition': 'An interposing move is a defensive move which occurs when the player causes a piece to block the line '
                'of action of an enemy piece that is attacking one of the players own pieces or important squares and, '
                'by doing so, removing the direct attack on the target. The simplest form is to move one of the '
                "player's own pieces in the middle of the line of action between the enemy piece and their own piece. "
                'However, attraction of enemy pieces that do not operate along the same line of action may also cause '
                'a defensive interposition. Note that in general terms interposing can refer to placing a piece in the '
                'line of action between any other two pieces, irrespective of the side involved, however on Chesstempo '
                'we make a clear distinction between situations like interference where the interposing occurs between '
                'the defensive connection of two enemy pieces, and this form of interposition that is occurring '
                'between an attacking enemy piece and one of your own pieces (or important squares).While the '
                'interposition tag is seen as a sub-type of defensive move, it may have attacking motives, securing a '
                'friendly piece while allowing an attack to progress on other parts of the board, so can often be seen '
                'as part of a larger attacking combination. As a general rule of thumb, if a piece is placed between '
                'an enemy piece and your own piece then a defensive interposition has occurred, but if a piece is '
                'placed (or attracted to) a position that is between two enemy pieces, blocking their defensive '
                'relationship, then that would be interference.Blocking is a third and separate concept that is often '
                'confused with interposition and interference moves. Blocking applies when you force an enemy piece to '
                'move to a square which otherwise could be used as an escape square for another enemy piece and NOT '
                'blocking lines of action between pieces.'},
 {'id': 'recapture',
  'name': 'Recapture',
  'family': 'Defensive Move',
  'definition': 'To be used only on purely defensive problems where the point of the problem is to simply recapture a '
                'piece captured by your opponent on the start move. Often the choice of how to recapture is critical.'},
 {'id': 'discovered_attack',
  'name': 'Discovered Attack',
  'family': 'Discovery',
  'definition': 'A discovered attack occurs when a player moves a piece which opens up an attack that was previously '
                'blocked by the moving piece. This attack may be on either another piece or an important square.'},
 {'id': 'discovered_check',
  'name': 'Discovered Check',
  'family': 'Discovered Attack',
  'definition': 'A discovered attack where the newly discovered piece checks the opponent king. If both the discovered '
                'and the discoverer are checking, use the double check tag instead.'},
 {'id': 'discoverer_checks',
  'name': 'Discoverer Checks',
  'family': 'Discovered Attack',
  'definition': 'A discovered attack where the moving piece (the discoverer) checks the opponent king. If both the '
                'discovered pieced and the discoverer are checking, use the double check tag instead.'},
 {'id': 'double_check',
  'name': 'Double Check',
  'family': 'Discovered Attack',
  'definition': 'A move that checks the opponent king with two pieces at the same time.'},
 {'id': 'discovered_defense',
  'name': 'Discovered Defense',
  'family': 'Discovery',
  'definition': 'A move that opens up a line of defense on a previously underdefended friendly piece or square that '
                'was previously being blocked by the moving piece.'},
 {'id': 'exposed_king',
  'name': 'Exposed King',
  'family': 'Non-mate Motifs',
  'definition': 'Exposed king is a tag to describe a situation of the king that allows one or more tactical blows such '
                'as forks, skewers, discoveries or even forcing checkmates. Exposed in this context means the king has '
                'lost the protection of its pawns or pieces, either because they have previously been taken , lured '
                'away, or the king itself has been forced away from its home based into an open and therefore exposed '
                'position. For this tag to apply, the king should be exposed at the start of the problem, rather than '
                'being exposed during the problem. This means that if you have to deliver a clearance sacrifice or a '
                'demolition sacrifice in order to put the king out in the open, then the king was not exposed at the '
                'start, and the tag should not apply. The lack of protection should allow for a direct check on the '
                'king for the tag to apply, but checks may also be possible without the king necessarily being '
                'considered exposed, so simply being capable of being checked does not necessarily indicate the tag '
                'should be applied. Exposure is not the same as vulnerability, meaning in a typical edge mate (such as '
                'back rank mate), the king is vulnerable but may not be exposed. Similarly, if you have to rely on a '
                'pin of a pawn or piece that is protecting the king in order to deliver a check on him, then he was '
                'not exposed for the purposes of this tag, despite his protection being insufficient. This tag is not '
                'intended to be used in later endgames, when the king goes to the middle of the board for strategic '
                'reasons. Also, it should not be applied in positions where the exposed nature of the king has no '
                'impact on the tactical outcome.'},
 {'id': 'aiming_sequence',
  'name': 'Aiming Sequence',
  'family': 'Gain of Tempo',
  'definition': 'An aiming sequence describes a sequence of moves where a piece first moves to make a threat that '
                'provides the tempo required to move the piece on the next move to another square where a subsequent '
                'threat can be delivered. For example, pushing a pawn to attack a piece that must move, and then '
                'pushing the pawn again to fork two pieces in order to win material. Knights can execute very '
                'effective aiming sequence attacks, for example first moving to attack a queen, and then after the '
                'queen moves, jumping to another square to fork the king and a rook. This motif is not designed to '
                'describe simple chains of tempo gaining moves, that happen to end end in a tactic, as the tempo gains '
                'in an aiming sequence are designed with a goal of reaching the piece to a square where it can perform '
                'a tactic, so the moving piece has a particular goal square target it is aiming at.'},
 {'id': 'appended_attack',
  'name': 'Appended Attack',
  'family': 'Gain of Tempo',
  'definition': 'An appended attack occurs when both sides appear to have offsetting capture sequences, but by '
                "capturing with the right piece at the end, you can add a new threat that upsets your opponent's "
                'intended recapture.'},
 {'id': 'desperado',
  'name': 'Desperado',
  'family': 'Gain of Tempo',
  'definition': 'A situation in which both sides have a piece (or pieces) hanging, and you capture material with your '
                'hanging piece in order to gain a more favourable material balance at the end of the sequence of '
                'captures.'},
 {'id': 'hit_and_run',
  'name': 'Hit and Run',
  'family': 'Gain of Tempo',
  'definition': 'Hit and run tactics are a sequence of 3 takes. First the player takes a defended piece, leaving their '
                'attacking piece under attack. At this point the opponent and player each have a piece mutually '
                'attacking each other. The opponent then takes the mutually attacking piece for the second take in the '
                'sequence, before the player retakes with the original attacking piece, simultaneously retaking and '
                'moving the attacking piece to safety. The mutual attack coupled with the initial take provides the '
                'tempo aspect of the tactic that allows the player to win material. There are two varieties of the hit '
                'and run motif, one where the first take is capturing the defender of the opponent piece that performs '
                'the second capture, and another where the first take discovers an attack on the opponent piece that '
                'performs the second capture.'},
 {'id': 'hit_and_run_capture_defender',
  'name': 'Hit and Run - Capture Defender',
  'family': 'Hit and Run',
  'definition': 'The hit and run of capture defender type starts with an attacker and opponent mutually attacking '
                'eachother via the two pieces (e.g. a queen attacking a queen), and the opponent piece is defended '
                "once. If the player can capture the opponent's defending piece with a second piece, leaving the "
                "previously defended piece now both unprotected and attacked by the player's first piece, this will "
                "perform the hit aspect of the hit and run. The second piece doing the 'hit' ends up being under "
                'attack itself after the hit, however if the now unprotected opponent piece captures the first piece '
                'that was mutually attacking it, and you are able to recapture with the second piece that took the '
                "opponent's defender, your second piece will retreat to safety, performing the run move with a "
                'simultaenous retreat and capture. The pieces that are mutually attacking each other are often queens, '
                'but other pieces can be involved. Note, it is fine to tag these sub-types with both capturing '
                'defender AND hit and run - capture defender tags.'},
 {'id': 'hit_and_run_discovery',
  'name': 'Hit and Run - Discovery',
  'family': 'Hit and Run',
  'definition': 'Hit and run of the discovery type is a specific type of discovered attack with gain of tempo. On the '
                'first move, you take an opponent piece and in doing so discover an attack over another unprotected '
                "opponent piece. This performs the hit move. The 'hit' piece will be under attack itself after the "
                'take. The unprotected opponent piece can capture your discovered piece that attacks it, but your '
                'piece that moved to discover the attack can recapture on the square the discovered piece was '
                'attacking from, recapturing the opponent piece, and gaining a tempo to retreat to safety. This '
                'retreat to safety with recapture is the run aspect of the hit and run. The two pieces attacking '
                'eachother after the discovery are often queens, but the motif can also be seen with other pieces. '
                'Note, it is fine to tag these sub-types with both discovered attack AND hit and run - discovery '
                'tags.'},
 {'id': 'jailbreak',
  'name': 'Jailbreak',
  'family': 'Gain of Tempo',
  'definition': 'A jailbreak occurs when one side finds themselves threatened by a tactic, but escapes (possibly '
                'winning material themselves), by moving a threatened piece and creating an offsetting threat. For '
                'example, if your opponent forks two of your pieces and you can move one and threaten a loose piece or '
                'create a mating threat, then this is a jailbreak.'},
 {'id': 'pendulum',
  'name': 'Pendulum',
  'family': 'Gain of Tempo',
  'definition': 'A pendulum is a sequence of moves that force your opponent to repeat moves, allowing you to improve '
                'the position of your piece in order to assist in an attack. The pendulum will often be performing '
                'some kind of clearance duty, and it is ok to tag a tactic with both tags if that is the case.'},
 {'id': 'reload',
  'name': 'Reload',
  'family': 'Gain of Tempo',
  'definition': 'The reload theme occurs when you attack with a piece that the opponent captures, but after the '
                'recapture, the attack is renewed. The reload gains a tempo, allowing you to perform another '
                'tactically important move, such as retreatiing another attacked piece to safety or to applying '
                'another tactical theme. When the moves that produce the attack and the reload are a check, they are '
                'sometimes called a reload check.'},
 {'id': 'reprotection',
  'name': 'Reprotection',
  'family': 'Gain of Tempo',
  'definition': 'Reprotection occurs when a move simultaneously takes a piece, and in doing so applies coverage to an '
                'otherwise unprotected, friendly piece or square that was under attack.'},
 {'id': 'rethreaten',
  'name': 'Rethreaten',
  'family': 'Gain of Tempo',
  'definition': 'A rethreaten pattern occurs when after an initial threat, your opponent moves to avoid the threat, '
                'but you follow up with a move that reestablishes an equivalent threat. Note, that this tag should not '
                'be made in cases where there is a simple series of checks. The key idea is the re-establishment of a '
                'previous tactical threat, as such, this tag will often apply in the context of another threat tag '
                'such as a fork/double attack, and it is fine to tag both the original threat and the the rethreaten '
                'tag in those cases.'},
 {'id': 'zwischenzug',
  'name': 'Zwischenzug',
  'family': 'Gain of Tempo',
  'definition': 'Zwischenzug (a German word for in-between move or intermediate move) refers to a tactic where the '
                'player postpones an anticipated move in order to make a forcing intermediate move (the '
                "'zwischenzug'), which results in the anticipated move being stronger when executed. The intermediate "
                'move is often overlooked by the opponent.'},
 {'id': 'capturing_attacker',
  'name': 'Capturing Attacker',
  'family': 'Zwischenzug',
  'definition': 'A common form of Zwischenzug arises when the player is faced with a choice between taking two pieces, '
                "but must choose to capture the opponent piece that is directly attacking one of the player's own "
                'pieces in order to gain material.'},
 {'id': 'hanging_piece',
  'name': 'Hanging Piece',
  'family': 'Non-mate Motifs',
  'definition': 'This is not a real tactical motif. It describes the initial position of a problem in which the '
                'opponent has left a piece to be taken for free, or has left a more valuable piece to be taken by a '
                'piece of lesser value. The tag should not be used when a piece is hanging after some other tactical '
                'motif has been applied, such as a Fork or Skewer or Pin. The hanging piece should be able to be taken '
                'with material gain on the first move, with no further moves required to secure the gain. In defensive '
                'only problems a hanging pawn may also be relevant, and if so this tag may be used.'},
 {'id': 'hook_and_ladder',
  'name': 'Hook and Ladder',
  'family': 'Non-mate Motifs',
  'definition': 'The Hook and Ladder Trick starts with a position in which your queen is attacking the enemy queen, '
                "defended by a rook at the opponent's back rank, and you can sacrifice a rook, delivering a check that "
                'attacks the enemy rook and put in place a luring the defender theme. There are three basic '
                'possibilities afterwards, according to the configuration of the initial position. First, if there is '
                'a weak back rank, whatever the relative position of the two queens, the opponent is forced to accept '
                'the sacrificed rook and lose their queen. Second, if the two queens and the defensive rook are '
                'aligned in a file, without a weak back rank and only one rook in the defense, the adversary could '
                'move their king, not accepting the sacrifice in order to avoid losing their queen, but this will '
                'allow you to take the defensive rook and your rook will become x-ray defended by your queen. Third, '
                'if there is not a weak back rank but two defensive rooks at the enemy back rank, the rook sacrifice '
                'will create a pin of one defensive rook against the other and if the adversary does not accept the '
                'sacrifice (losing their queen) the exchange of queens will force the clearance of the back rank, '
                'allowing you to capture the other rook for free.'},
 {'id': 'mate_threat',
  'name': 'Mate Threat',
  'family': 'Non-mate Motifs',
  'definition': 'The opponent loses material due to having to protect their king from being mated. This should not be '
                'applied to problems where the king is actually mated, and should not apply to weak back rank problems '
                'which are a special case of this motif.'},
 {'id': 'backwards_move',
  'name': 'Backwards Move',
  'family': 'Move Types',
  'definition': 'A backwards move is a move where the player needs to retreat a piece down the board, either on a file '
                'or along a diagonal. The retreat move may be an attacking or defensive move (or both!). Often the '
                'longer the distance, the harder the move is to see, with moves along long diagonals often missed. '
                'This tag should be reserved for situations where the backwards move was something that was easy to '
                'miss, and tactically significant to the current position.'},
 {'id': 'en_passant',
  'name': 'En Passant',
  'family': 'Move Types',
  'definition': 'A tag to be used where en passant is a relevant consideration in determining the outcome of the '
                'position.'},
 {'id': 'long_lateral_move',
  'name': 'Long Lateral Move',
  'family': 'Move Types',
  'definition': 'A long lateral move along a rank by a rook or queen can often be easy to miss, similar to longer '
                'backwards moves. This tag should be reserved for situations where the lateral move was something that '
                'was easy to miss, and tactically significant to the current position.'},
 {'id': 'tactical_castling',
  'name': 'Tactical Castling',
  'family': 'Move Types',
  'definition': 'This tag covers castling moves that have tactical significance. These moves are rare, but can produce '
                'spectacular tactics when they do. This tag is not to be used when castling occurs for purely '
                'positional reasons. The tactical point may however be either attacking or defensive.'},
 {'id': 'double_attack',
  'name': 'Double Attack',
  'family': 'Multiple Attack',
  'definition': 'A Double Attack occurs when two or more pieces simultaneously attack multiple opponent pieces or '
                "important squares. The opponent can't counter all threats so loses material. This tag is not to be "
                'used in pure discovered attack situations where one piece moves to attack another piece, while at the '
                'same time creating a discovered attack from a second piece. However a double attack can be the '
                'consequence of other motifs such as pin, interference, a capturing defender, mate threat, etc and it '
                'is valid to use both tags in this situation.'},
 {'id': 'fork',
  'name': 'Fork',
  'family': 'Multiple Attack',
  'definition': 'A Fork occurs when a single piece attacks multiple opponent pieces or important squares.'},
 {'id': 'family_fork',
  'name': 'Family Fork',
  'family': 'Fork',
  'definition': 'A specific type of knight fork where the knight forks the enemy king, queen and one or both rooks.'},
 {'id': 'royal_fork',
  'name': 'Royal Fork',
  'family': 'Fork',
  'definition': 'A specific type of knight fork where the knight forks the enemy king and queen, winning the queen.'},
 {'id': 'tag_team',
  'name': 'Tag Team',
  'family': 'Multiple Attack',
  'definition': 'A tag team attack occurs when two or more pieces simultaneously attack only one piece or important '
                'square of the adversary, leading the opponent to lose material or suffer other loss. In general this '
                'tag is not to be used in pure discovered attack situations where one piece moves to attack another '
                'piece, while at the same time creating a discovered attack from a second piece. An exception where '
                'both tag team attack and discovered attack would apply is if both the moving piece and the discovered '
                'piece are attacking the same piece (i.e. a tag team attack). Note that many, but not all tag team '
                'attacks will overlap with the battery tags, and it is ok to apply both tags in those situations. Tag '
                'team attacks may also contain other forms of multiple attacks, such as forks, and it is fine to tag '
                'both.'},
 {'id': 'needs_different_opponent_move',
  'name': 'Needs Different Opponent Move...',
  'family': 'Non-mate Motifs',
  'definition': 'This is a tag used to make suggestions on a different opponent move in a problem that would improve '
                "the problem's quality. Note that not all suggestions can be used, as they can often make a solution "
                'line ambiguous.'},
 {'id': 'needs_more_moves',
  'name': 'Needs More Moves...',
  'family': 'Non-mate Motifs',
  'definition': 'This is a tag used to make suggestions on a move that should be added as a continuation to improve a '
                'problem. Currently, only one move should be suggested, and it should follow on directly from the end '
                'of the current line. When processing the suggestion, the generator will try to extend further if '
                'possible. Note that not all suggestions can be used, as they can often make a solution line '
                'ambiguous.'},
 {'id': 'overloading',
  'name': 'Overloading',
  'family': 'Non-mate Motifs',
  'definition': 'Overloading occurs when a defensive piece is required to protect more than one piece or square at a '
                'time, but can only perform one of the defensive tasks adequately. Overloading tactics usually include '
                'a distraction tactic, but it can also exist as a independent motif.'},
 {'id': 'absolute_pin',
  'name': 'Absolute Pin',
  'family': 'Pin',
  'definition': 'An absolute pin occurs when an attacked piece is in front of, and in the same line of attack as the '
                "pinned piece's king. The pinned pieced is therefore not able to legally move off the line of attack."},
 {'id': 'cross_pin',
  'name': 'Cross-pin',
  'family': 'Pin',
  'definition': 'A cross-pin occurs when a piece is pinned from multiple directions.'},
 {'id': 'relative_pin',
  'name': 'Relative Pin',
  'family': 'Pin',
  'definition': 'A relative pin occurs when an attacked piece is in front of, and in the same line of attack as a '
                'piece or square of higher value. Any piece behind the pinned piece is not the king in a relative pin, '
                'therefore the pinned piece can legally move, but in doing so may expose the previously shielded piece '
                'to capture.'},
 {'id': 'mate_pin',
  'name': 'Mate Pin',
  'family': 'Relative Pin',
  'definition': 'A mate pin occurs when an attacked piece is in front of, and in the same line of attack as a square '
                'that if the attacker reaches would lead to a forced mate for the attacker. The pinned piece is '
                'vulnerable, as moving off the line of attack without tempo will lead to checkmate, often taking the '
                "attacker is the defender's best option. Note that sometimes these positions can look like skewers if "
                'there is an opponent piece on the potential mating square that is lower value than the piece being '
                'attacked, however the main point here is the pin , not the skewer, and pin would be the appropriate '
                'tag. Mate pins overlap with the mate threat tag, and it is ok to tag with both.'},
 {'id': 'quiet_move',
  'name': 'Quiet Move',
  'family': 'Non-mate Motifs',
  'definition': 'A move which is not forcing, i.e. a move which does not directly attack or capture an enemy piece. In '
                'tactics problems, a quiet move is often used to control important squares or guard your own pieces '
                'from future capture, before launching a more direct attack in subsequent moves.'},
 {'id': 'capturing_defender',
  'name': 'Capturing Defender',
  'family': 'Removing the Guard',
  'definition': 'The player captures an opponent piece that was previously defending a piece or square, leading to the '
                'previously defended piece or square to come under attack. This is often called removing defender, but '
                'to avoid overlap with the distraction motif (where the defender is removed by distracting it away '
                'rather than taking it), the more specific, "Capturing Defender" is used instead.'},
 {'id': 'distraction',
  'name': 'Distraction',
  'family': 'Removing the Guard',
  'definition': 'Distraction (sometimes called deflection) involves forcing the opponent to move a piece that was '
                'previously guarding important squares or pieces. This motif comes in two sub-varieties, attacking the '
                'defender, and luring the defender.'},
 {'id': 'attacking_the_defender',
  'name': 'Attacking the Defender',
  'family': 'Distraction',
  'definition': 'A tactic where a defensive unit is distracted from its defensive duties by subjecting it to direct '
                'attack. The piece must move and the previously defended piece (or square) becomes vulnerable. Note '
                'the attacked piece is not actually taken in this motif, if it was, a capturing the defender tag would '
                'instead apply. It is also not moving away to perform another duty as in the luring subtype of '
                'distraction, but rather moving simply to flee the attack.'},
 {'id': 'luring_the_defender',
  'name': 'Luring the Defender',
  'family': 'Distraction',
  'definition': 'Luring the Defender is a tactical theme that occurs when you distract a defensive unit from its '
                'duties by luring it to another square, for example by creating a threat that the piece must move to '
                'respond to. Note that while distraction by luring contrasts with distraction by attacking, the lured '
                'away defender may actually be attacked. The key idea in luring is that the movement of the defender '
                'to another square occurs in order to perform another duty on that square, such as recapturing a piece '
                'that was captured by the opponent or blocking an attack, rather than moving away simply to flee an '
                'attack. Indeed the lured piece may continue to be under attack on its new square.'},
 {'id': 'interference',
  'name': 'Interference',
  'family': 'Removing the Guard',
  'definition': 'Interference occurs when a player cuts the defensive contact between two enemy pieces, removing the '
                'guard of one or both of them, thus creating potential targets for attack. The player cuts the line '
                'between an opponent bishop, rook or queen and a piece or important square they are defending by '
                'either placing one of their own pieces at the middle of the defensive line or forcing the opponent to '
                'do so with one of their pieces. Interference can be delivered simultaneously with a fork, when the '
                'piece in the middle attacks both adversary pieces. The difference between interference and blocking '
                'is that interference blocks the defense of one enemy piece over another enemy piece (or important '
                'square) and blocking prevents an enemy piece from moving to an escape square by forcing the placement '
                'of another enemy piece on the potential escape square. Interference should not be confused with '
                'defensive interposition. If a player defends a check or an attack from an enemy piece by interposing '
                'a piece in the line of the attacker, this is not interference because that line is obviously not a '
                'defensive contact of two enemy pieces.'},
 {'id': 'demolition_sacrifice',
  'name': 'Demolition Sacrifice',
  'family': 'Sacrifice',
  'definition': 'A sacrifice aimed at destroying the pawn structure in front of the enemy king.'},
 {'id': 'greek_gift',
  'name': 'Greek Gift',
  'family': 'Demolition Sacrifice',
  'definition': 'A subtype of Demolition Sacrifice, the Greek Gift (also called the classical bishop sacrifice) occurs '
                'when either white plays Bxh7+ or black plays Bxh2+, taking the h pawn with check. The greek gift is '
                'often the prelude to a follow up attack on the king.'},
 {'id': 'exchange_sacrifice',
  'name': 'Exchange Sacrifice',
  'family': 'Sacrifice',
  'definition': 'An exchange sacrifice is a move where the player deliberately loses a rook for a knight or bishop to '
                'gain advantage in subsequent moves.'},
 {'id': 'passive_sacrifice',
  'name': 'Passive Sacrifice',
  'family': 'Sacrifice',
  'definition': 'A Passive Sacrifice is one where the player lets the opponent capture the sacrificed piece in order '
                'to gain tempo to maneuver their other pieces, commonly in a path to a checkmate. In a passive '
                'sacrifice you are not moving a piece to a square (or taking a piece on a square) where your piece can '
                'be subsequently taken. Rather, you are simply choosing to leave a piece in a position where the '
                'opponent can take it. Retakes of passive sacrifices should generally be seen as coercion instead of '
                'attraction due to the lack of an active sacrifice.'},
 {'id': 'pawn_sacrifice',
  'name': 'Pawn Sacrifice',
  'family': 'Sacrifice',
  'definition': 'A pawn sacrifice is a move where the player deliberately loses a pawn to gain advantage in subsequent '
                'moves.'},
 {'id': 'simplification',
  'name': 'Simplification',
  'family': 'Non-mate Motifs',
  'definition': 'Simplification occurs when a player decides to swap material to emphasise an advantage already '
                'gained. Often used tactically in the endgame to assist in pawn promotion.'},
 {'id': 'relative_skewer',
  'name': 'Relative Skewer',
  'family': 'Skewer',
  'definition': 'The player attacks a piece of the opponent, other than the king, which while it can legally move, '
                'cannot do so without exposing a square or piece of lesser or equal value behind it to attack. The '
                'front piece usually moves, allowing the piece behind it to be captured.'},
 {'id': 'skewer_of_queen',
  'name': 'Skewer of Queen',
  'family': 'Relative Skewer',
  'definition': 'The player attacks an opponent Queen which cannot move without exposing a less valuable square or '
                'piece behind it to attack. The front piece usually moves, allowing the piece behind it to be '
                'captured.'},
 {'id': 'skewer_of_rook',
  'name': 'Skewer of Rook',
  'family': 'Relative Skewer',
  'definition': 'The player attacks an opponent Rook which cannot move without exposing a square or piece of lesser or '
                'equal value behind it to attack. The front piece usually moves, allowing the piece behind it to be '
                'captured.'},
 {'id': 'skewer_of_king',
  'name': 'Skewer of King',
  'family': 'Skewer',
  'definition': 'The player attacks the opponent king, while another opponent piece is in the same line of attack '
                'behind the king. The king is forced to move, exposing the piece behind it to attack. Sometimes called '
                'an absolute skewer.'},
 {'id': 'trapped_piece',
  'name': 'Trapped Piece',
  'family': 'Non-mate Motifs',
  'definition': 'A piece is trapped when it has no safe squares to escape to thus making it highly susceptible to '
                'capture. While mated kings are technically trapped, this tag should only be applied to non-mate '
                'situations.'},
 {'id': 'unpinning',
  'name': 'Unpinning',
  'family': 'Non-mate Motifs',
  'definition': 'Removing a pin on a piece so it can be used for tactical advantage.'},
 {'id': 'unsound_sacrifice',
  'name': 'Unsound Sacrifice',
  'family': 'Non-mate Motifs',
  'definition': 'A sacrifice made by the opponent on the false assumption that they will later get the material back. '
                'Unsound Sacrifice is often the reason for a Hanging Piece problem, and it is acceptable to use both '
                'tags in that situation.'},
 {'id': 'weak_back_rank',
  'name': 'Weak Back Rank',
  'family': 'Non-mate Motifs',
  'definition': 'In some situations back rank mate might not be possible , but the threat of a bank rank mate may be '
                'enough for a player to win material.'},
 {'id': 'win_the_exchange',
  'name': 'Win the Exchange',
  'family': 'Non-mate Motifs',
  'definition': 'To win a rook in exchange for a knight or bishop. This will usually involve another motif (unless the '
                'rook was hanging), and it is acceptable to use both this tag, and the other motifs that make the '
                'exchange win possible.'},
 {'id': 'windmill_discoveries',
  'name': 'Windmill - Discoveries',
  'family': 'Windmill',
  'definition': 'The discovery form of a windmill attack wins multiple pieces by using several discovered checks '
                'chained together. A rook discovering attacks from a bishop is a common form of this attack.'},
 {'id': 'windmill_knight_fork',
  'name': 'Windmill - Knight Fork',
  'family': 'Windmill',
  'definition': 'The knight fork windmill is a windmill where the knight is used to repeatedly check the opponent '
                'king, and then take a piece, repeating the check and take to win multiple pieces.'},
 {'id': 'x_ray_attack',
  'name': 'X-Ray Attack',
  'family': 'X-Ray',
  'definition': 'An X-ray attack occurs when a piece of yours attacks an enemy piece or an important square (the '
                "target of the attack) through an enemy piece that is placed in the middle of your attacking piece's "
                'line of action. Your attacker and the enemy piece at the middle must have the same line of action in '
                'a stretch of diagonal, file or rank, meaning the enemy piece must be able to attack your attacker and '
                'defend the target. So, a bishop can not X-ray attack through a rook, or a rook through a bishop or '
                'any piece through a knight, but it is possible to X-ray attack through a pawn, when the target of the '
                'X-ray is defended by the pawn, despite the pawn being unable to attack your attacker. If this is not '
                'the case, then other motifs like skewer, pin, discover or clearance may be more appropriate.Unlike in '
                'a skewer or a pin, the relative value of your attacker and the piece being attacked through is '
                'irrelevant. If there is not an attack or defense through an enemy piece or the enemy piece moves out '
                'of the line of action of your piece, allowing the attack or defense of the target, then this is not '
                'an X-ray and other motifs like skewer, pin, discovery or clearance may be more appropriate. The X-ray '
                'should not be confused with a Battery, which represents an attack or defense though a friendly piece, '
                'not an enemy piece.In problems, an X-ray attack is often already placed at the board after the '
                'pre-move, and you have to find out a way to take advantage of this. However, there are exceptions, '
                'for instance you can create an X-ray attack utilizing a discovery or a clearance or even a mate '
                'threat and subsequently take advantage of it. Often an X-ray attack will end up as an X-ray defense, '
                'after another piece of yours takes on (or moves to) the X-ray attacked square. In these situations '
                'the initial X-ray attack should be tagged, not the resulting X-ray defense. Due to previously only '
                'having an X-ray attack tag and no X-ray defense, many defense positions are currently mistagged as '
                'attack, please downvote X-ray attack and upvote X-ray defense when you notice this issue.'},
 {'id': 'x_ray_defense',
  'name': 'X-Ray Defense',
  'family': 'X-Ray',
  'definition': 'An X-ray defense occurs when you move a piece in order to defend a piece or square through an enemy '
                'piece. The only way for your piece to X-ray defend a piece or square through an enemy piece is when '
                'your attacking piece and the enemy piece have the same line of action in a stretch of diagonal, file '
                'or rank, meaning the enemy piece at the middle of an X-ray must be able to attack your attacker and '
                'the target of the X-ray defense. So, a bishop can not X-ray defend through a rook, or a rook through '
                'a bishop or any piece through a knight, but it is possible to X-ray defend through a king or even '
                'through a pawn, when the target of the X-ray is contiguous to the king or attacked by the pawn '
                '(despite the pawn not being able to attack your attacking piece).Unlike in a skewer or a pin, the '
                'relative value of your attacker and the piece being attacked through is irrelevant. If there is not '
                'an attack or defense through an enemy piece or the enemy piece moves out of the line of action of '
                'your piece, allowing the attack or defense of the target, then this is not an X-ray and other motifs '
                'like skewer, pin, discovery or clearance may be more appropriate. The X-ray should not be confused '
                'with a Battery, which represents an attack or defense though a friendly piece, not an enemy '
                'piece.Often an X-ray attack will end up as an X-ray defense, after another piece of yours takes on '
                '(or moves to) the X-ray attacked square. In these situations the initial X-ray attack should be '
                'tagged, not the resulting X-ray defense. Due to previously only having an X-ray attack tag and no '
                'X-ray defense, many defense positions are currently mistagged as attack, please downvote X-ray attack '
                'and upvote X-ray defense when you notice this issue.'},
 {'id': 'zugzwang',
  'name': 'Zugzwang',
  'family': 'Non-mate Motifs',
  'definition': 'Zugzwang (a German word meaning compulsion to move) refers to the situation where a player would '
                "prefer not to make a move as all legal moves would make the player's position worse."},
 {'id': 'clearance',
  'name': 'Clearance',
  'family': 'Parent',
  'definition': 'Clearance comes in two forms, the first is where a player moves one of their own pieces to clear a '
                'square for another of their pieces. The second form of clearance occurs when one player forces a '
                'piece away from a diagonal, rank or file (often using a sacrifice) to make way for another piece to '
                'utilise or attack the cleared path. Note that clearances where the player clears a piece to make way '
                'for a piece behind it to attack another square or piece is sometimes referred to as clearance, '
                'however on Chess Tempo these should be considered discovered attacks.'},
 {'id': 'counting',
  'name': 'Counting',
  'family': 'Parent',
  'definition': 'Counting (of attacks and defenses over all pieces in contact on the board) is the name of a technique '
                'used to identify opportunities to gain material through a series of exchanges of pieces. Two motifs '
                'related to this technique are the underprotected piece and multi-square counting motifs which are '
                'treated as subtypes of the general counting technique.'},
 {'id': 'defensive_move',
  'name': 'Defensive Move',
  'family': 'Parent',
  'definition': 'The opponent has a serious threat, and you must meet it in the correct manner. Other methods of '
                'meeting the threat do not win.'},
 {'id': 'discovery',
  'name': 'Discovery',
  'family': 'Parent',
  'definition': 'A move that opens up a line of attack or defense from or to another friendly piece or square. The '
                'most common variety is a discovered attack where the movement of the piece opens an attack from a '
                'piece that was previously blocked by the moving piece, however discoveries can do both attacking AND '
                'defensive duties.'},
 {'id': 'gain_of_tempo',
  'name': 'Gain of Tempo',
  'family': 'Parent',
  'definition': 'Moves designed to gain tempo form the basis of several tactical motifs. A tempo gaining move is one '
                'which creates a threat that requires the opponent to waste a move responding.'},
 {'id': 'move_types',
  'name': 'Move Types',
  'family': 'Parent',
  'definition': 'The following group of motifs involving a particular type of chess move. For example , en-passant, '
                'castling, backwards moves and long lateral moves.'},
 {'id': 'multiple_attack',
  'name': 'Multiple Attack',
  'family': 'Parent',
  'definition': 'A Multiple Attack occurs when one player simultaneously attacks multiple opponent pieces or important '
                "squares. The opponent can't counter all threats so loses material. This tag is not to be used in pure "
                'discovered attack situations where one piece moves to attack another piece, while at the same time '
                'creating a discovered attack from a second piece.'},
 {'id': 'pin',
  'name': 'Pin',
  'family': 'Parent',
  'definition': 'A pin occurs when an attacked piece cannot move without exposing a more valuable piece or square '
                'behind it to attack.'},
 {'id': 'removing_the_guard',
  'name': 'Removing the Guard',
  'family': 'Parent',
  'definition': 'A tactic where a piece guarding one of its own pieces (or important squares) is rendered unable to '
                'continue the guard, thus leading the guarded piece to become vulnerable. There are 4 main '
                'sub-varieties of this motif, luring the defender, attacking the defender, capturing the defender and '
                'interference. Luring and attacking the defender are both considered sub-types of distraction.'},
 {'id': 'sacrifice',
  'name': 'Sacrifice',
  'family': 'Parent',
  'definition': 'A sacrifice is a move where the player deliberately loses a piece to gain advantage in subsequent '
                'moves. Tactical sacrifices usually result in an imminent material gain. Sacrifices are often used in '
                'combination with other tactical motifs.'},
 {'id': 'skewer',
  'name': 'Skewer',
  'family': 'Parent',
  'definition': 'The player attacks a piece of the opponent, which cannot move without exposing a square or piece of '
                'lesser or equal value behind it to attack. The front piece usually moves, allowing the piece behind '
                'it to be captured.'},
 {'id': 'windmill',
  'name': 'Windmill',
  'family': 'Parent',
  'definition': 'Windmill attacks involve a series of repeated checks where the player can check, then take a piece, '
                'repeating the check/take cycle multiple times. There are two varieties of the windmill, one driven by '
                'knight forks, and the other driver by multiple discovered attacks.'},
 {'id': 'x_ray',
  'name': 'X-Ray',
  'family': 'Parent',
  'definition': 'An X-ray is a tactic with three points: a piece of yours, an enemy piece at the middle and a target '
                'that could be a square or a piece. The target is an enemy in an X-ray attack and a friend in an X-ray '
                'defense. An X-ray occurs when your piece attacks or defends the target through the enemy piece in the '
                'middle. The only way to do so is when your piece and the middle enemy piece has the same line of '
                'action in a stretch of diagonal, file or rank, meaning the enemy piece necessarily must be able to '
                'attack your piece and to defend the target (in a X-ray attack) or attack the target (in X-ray '
                'defense). So, a bishop can not X-ray through a rook, neither a rook through a bishop, nor any piece '
                'through a knight, but it is possible to X-ray through a king or even through a pawn, when the target '
                'of the X-ray is contiguous to the king or defended by the pawn.Unlike in a skewer or a pin, the '
                'relative value of your attacker and the piece being attacked through is irrelevant. If there is not '
                'an attack or defense through an enemy piece or the enemy piece moves out of the line of action of '
                'your piece, allowing the attack or defense of the target, then this is not an X-ray and other motifs '
                'like skewer, pin, discovery or clearance may be more appropriate. The X-ray should not be confused '
                'with a Battery, which represents an attack or defense though a friendly piece, not an enemy piece.'},
 {'id': 'advanced_pawn',
  'name': 'Advanced Pawn',
  'family': 'Parent',
  'definition': 'An advanced pawn is a pawn that has either progressed or threatens to progress past the centre of the '
                'board and is participating in the tactic in a meaningful way. This may include actual promotion, '
                'promotion threats, or simply participating in the tactic while in an advanced position. An advanced '
                'Pawn can achieve a gain of material or mate by being promoted or forcing the adversary to sacrifice a '
                'piece in order to prevent the promotion or take the promoted piece. Threat of promotion of a passed '
                'pawn is often seen at the heart of tactical possibilities, as the resources required to prevent the '
                'promotion are not available to help elsewhere on the board. An advanced pawn can also harass the king '
                'at his home without promoting or threatening promotion by supporting attacking pieces, controlling '
                'escape squares, being part of a demolition of pawn structures and being an essential part of attacks '
                'on the king in the middle game that either achieve mate or result in gain of material.'}]


def all_motifs() -> list[dict[str, str]]:
    return [dict(item) for item in CHESSTEMPO_MOTIFS]


def motif_names() -> list[str]:
    return [str(item["name"]) for item in CHESSTEMPO_MOTIFS]


def motif_lookup() -> dict[str, dict[str, str]]:
    return {str(item["name"]).lower(): dict(item) for item in CHESSTEMPO_MOTIFS}


def family_names() -> list[str]:
    return sorted({str(item["family"]) for item in CHESSTEMPO_MOTIFS})
