@help
Feature: Help library
  In order to handle heat, farrowing, illness and injuries correctly
  As a caretaker
  I need to find practical guides quickly

  Background:
    Given I am signed in as the caretaker
    And I open "/help"

  @smoke @HELP-01
  Scenario: The help library lists guides and articles
    Then I should see "Como podemos ajudar?"
    And I should see "Guias práticos"
    And I should see "Base de conhecimento"

  @smoke @HELP-02
  Scenario: Search for a topic
    When I search the help for "cio"
    Then I should see the help result "Cio"

  @HELP-03
  Scenario: A search without results
    When I search the help for "xyzzy"
    Then I should see "Nada encontrado. Tente outra palavra."

  @HELP-04
  Scenario: Open a guide
    When I click the help result "Peste Suína Africana"
    Then I should see the heading "Peste Suína Africana"

  @HELP-05
  Scenario: Search ignores accents
    When I search the help for "carencia"
    Then I should see the help result "Período de carência: o que é e como respeitar"
