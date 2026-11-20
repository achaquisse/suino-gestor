@herd
Feature: Herd overview
  In order to know the state of my animals at a glance
  As a farm member
  I need to browse pens, search animals and open their records

  Background:
    Given I am signed in as the owner
    And I open "/herd"

  @smoke @HERD-01
  Scenario: Herd KPIs summarise the farm
    Then the herd KPI "Animais" should match the number of live animals in the farm
    And I should see "8 currais"

  @smoke @HERD-02
  Scenario: Search an animal by ear tag
    When I search the herd for "S-009"
    Then I should see "Resultados para “S-009”"
    And the animal list should show "1 animal"
    And I should see the animal "S-009" in the list

  @HERD-03
  Scenario: A search without matches shows an empty list
    When I search the herd for "ZZZ-999"
    Then the animal list should show "0 animais"

  @HERD-04
  Scenario: The breeders KPI filters the list
    When I click the herd KPI "Reprodutoras"
    Then I should be on a page whose URL contains "stage=breeders"
    And the animal list count should equal the herd KPI "Reprodutoras"

  @smoke @HERD-05
  Scenario: Open a pen
    When I open the pen "Maternidade A"
    Then I should see the heading "Maternidade A"
    And I should see "Ocupação"
    And I should see "Animais no curral"

  @smoke @HERD-06
  Scenario: Open an animal record
    When I open the animal "S-009"
    Then I should see the heading "S-009"
    And I should see "Porca"
    And I should see "Dados do animal"

  @HERD-07
  Scenario: An unknown ear tag shows a not-found message
    When I open "/herd/animals/NOPE-1"
    Then I should see "Animal não encontrado"

  @future @HERD-08
  Scenario: Export the herd list
    When I open "/herd?view=list"
    And I download the file from the button "Exportar"
    Then the downloaded file name should end with ".csv"

  @HERD-09
  Scenario: The pens view shows the farm layout and the pen page highlights its pen
    When I open "/herd"
    Then I should see "Esquema da granja"
    When I open the pen "Engorda A"
    Then I should see "Localização na granja"
    And the layout should highlight the pen "Engorda A"
