@quicklog
Feature: Quick log of field events
  In order to keep records accurate while working in the pens
  As a caretaker or owner
  I need to log weights, treatments, breeding, births, moves, deaths and sales in a few taps

  @smoke @LOG-01
  Scenario: The quick log menu lists all event types
    Given I am signed in as the owner
    When I click the button "Novo"
    Then the sheet "Registar" should be open
    And the sheet should offer the options:
      | option        |
      | Parto         |
      | Doença        |
      | Transferência |
      | Cobertura     |
      | Tratamento    |
      | Peso          |
      | Morte         |
      | Venda         |
      | Despesa       |
      | Actividade    |

  @smoke @mutation @LOG-02
  Scenario: Record a weight for an animal
    Given I am signed in as the owner
    When I open the animal "G-101"
    And I choose "Peso" from the animal's Registar menu
    And I fill "Peso (kg)" with "45"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Peso registado · G-101"
    And I should see "45 kg"

  @LOG-03
  Scenario: A weight is required
    Given I am signed in as the owner
    When I open the animal "G-101"
    And I choose "Peso" from the animal's Registar menu
    And I submit the sheet with "Guardar"
    Then the sheet should show the error "Indique um peso válido"

  @future @mutation @LOG-04
  Scenario: An implausible weight is rejected
    Given I am signed in as the owner
    When I open the animal "G-104"
    And I choose "Peso" from the animal's Registar menu
    And I fill "Peso (kg)" with "5000"
    And I submit the sheet with "Guardar"
    Then the sheet should show an error
    And I should not see the toast "Peso registado"

  @mutation @LOG-05
  Scenario: Record a treatment for an animal
    Given I am signed in as the owner
    When I open the animal "G-103"
    And I choose "Tratamento" from the animal's Registar menu
    And I submit the sheet with "Guardar"
    Then I should see the toast "Tratamento registado"

  @mutation @LOG-06
  Scenario: Record a mating
    Given I am signed in as the owner
    When I open the animal "S-021"
    And I choose "Cobertura" from the animal's Registar menu
    And I submit the sheet with "Guardar"
    Then I should see the toast "Cobertura registada · S-021"

  @smoke @mutation @LOG-07
  Scenario: Record a farrowing
    Given I am signed in as the owner
    When I open the animal "S-009"
    And I choose "Parto" from the animal's Registar menu
    And I submit the sheet with "Guardar"
    Then I should see the toast "Parto registado · S-009 · 11 vivos"

  @mutation @LOG-08
  Scenario: Transfer an animal to another pen
    Given I am signed in as the owner
    When I open the animal "G-114"
    And I choose "Transferir" from the animal's Registar menu
    And I select the option starting with "Engorda B" in "Destino"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Transferência registada"
    When I open the animal "G-114"
    Then the breadcrumb should show "Engorda B"

  @smoke @mutation @LOG-09
  Scenario: Record a death
    Given I am signed in as the owner
    When I open the quick log
    And I pick "Morte" in the sheet
    And I select the option starting with "N-218" in "Animal"
    And I fill "Causa" with "Pneumonia"
    And I submit the sheet with "Registar morte"
    Then I should see the toast "Morte registada · N-218"
    When I open the animal "N-218"
    Then I should see "Morto"
    And I should not see the button "Registar"

  @LOG-10
  Scenario: A sale is blocked while the animal is in withdrawal
    Given I am signed in as the owner
    When I open the animal "F-066"
    And I choose "Vender" from the animal's Registar menu
    Then I should see "venda bloqueada"
    When I submit the sheet with "Guardar"
    Then the sheet should show the error "venda bloqueada"

  @smoke @mutation @LOG-11
  Scenario: Sell an animal
    Given I am signed in as the owner
    When I open the animal "F-061"
    And I choose "Vender" from the animal's Registar menu
    Then the sale total should be 6790 meticais
    When I fill "Comprador" with "Talho Central"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Venda registada · F-061"
    When I open the animal "F-061"
    Then I should see "Vendido"

  @LOG-12
  Scenario: An activity needs a title
    Given I am signed in as the owner
    When I click the button "Novo"
    And I pick "Actividade" in the sheet
    And I submit the sheet with "Guardar"
    Then the sheet should show the error "Indique o título da actividade."

  @rbac @LOG-13
  Scenario: The caretaker's quick log has no money entries
    Given I am signed in as the caretaker
    When I open the quick log
    Then the sheet should offer the options:
      | option     |
      | Peso       |
      | Tratamento |
    But the sheet should not offer the options:
      | option  |
      | Venda   |
      | Despesa |

  @LOG-14
  Scenario: Saving while offline shows a clear error
    Given I am signed in as the owner
    When I open the animal "G-105"
    And I choose "Peso" from the animal's Registar menu
    And I fill "Peso (kg)" with "40"
    And the device goes offline
    And I submit the sheet with "Guardar"
    Then the sheet should show the error "Sem ligação à internet"

  @future @mutation @LOG-15
  Scenario: A death can be recorded from the animal page
    Given I am signed in as the owner
    When I open the animal "N-217"
    And I choose "Morte" from the animal's Registar menu
    And I submit the sheet with "Registar morte"
    Then I should see the toast "Morte registada · N-217"

  @mutation @LOG-16
  Scenario: Record another kind of sale
    Given I am signed in as the owner
    When I click the button "Novo"
    And I pick "Venda" in the sheet
    And I click the tab "Outra venda"
    And I fill "O que foi vendido" with "Estrume E2E"
    And I fill "Valor (MT)" with "800"
    And I fill "Comprador" with "Machamba Vizinha"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Venda registada · Estrume E2E"
