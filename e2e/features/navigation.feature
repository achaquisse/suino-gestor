@navigation
Feature: Navigation and access control
  In order to only see what my role allows
  As a farm member
  I need the navigation and pages to respect my role

  @smoke @rbac @NAV-01
  Scenario: The owner sees the full navigation
    Given I am signed in as the owner
    Then I should see the main navigation item "Animais"
    And I should see the main navigation item "Stock"
    And I should see the main navigation item "Despesas"
    And I should see the main navigation item "Relatórios"
    And I should see the main navigation item "Ajuda"

  @rbac @NAV-02
  Scenario: The caretaker only sees field navigation
    Given I am signed in as the caretaker
    Then I should see the main navigation item "Animais"
    And I should see the main navigation item "Stock"
    And I should see the main navigation item "Ajuda"
    But I should not see the main navigation item "Despesas"
    And I should not see the main navigation item "Relatórios"

  @rbac @NAV-03
  Scenario: The caretaker cannot open finance pages by URL
    Given I am signed in as the caretaker
    When I open "/money"
    Then I should see "Sem acesso às despesas"
    When I open "/reports"
    Then I should see "Sem acesso"
    And I should not see "Demonstração de resultados"

  @NAV-04
  Scenario: An unknown address shows a friendly not-found page
    Given I am signed in as the owner
    When I open "/isto-nao-existe"
    Then I should see "Página não encontrada"

  @NAV-05
  Scenario: The owner switches to another farm
    Given I am signed in as the owner
    When I switch to my second farm from the user menu
    Then I should see the toast "Mudou para"
    And the header should show my second farm

  @future @NAV-06
  Scenario: The Today dashboard is the home page
    Given I am signed in as the owner
    When I open "/"
    Then I should be on a page whose URL ends with "/"
    And I should see the heading "Hoje"
    And I should see "Tarefas"
