@money
Feature: Expenses
  In order to know where the farm's money goes
  As the owner
  I need to record expenses, while investors can only read them (income and results are in Relatórios)

  @smoke @MON-01
  Scenario: The owner sees the expenses page, without income or results
    Given I am signed in as the owner
    When I open "/expenses"
    Then I should see the heading "Despesas"
    And I should see "Compromissos"
    And I should see the button "Nova despesa"
    But I should not see "Resultado"
    And I should not see "Receita vs despesas"

  @smoke @mutation @MON-02
  Scenario: Record an expense
    Given I am signed in as the owner
    When I open "/expenses"
    And I click the button "Nova despesa"
    And I choose the expense category "Veterinário"
    And I fill "Valor (MT)" with "1500"
    And I add the description "Ração E2E" in the movement details
    And I click the button "Registar despesa"
    Then I should see the toast "Despesa registada"
    When I search the movements for "Ração E2E"
    Then I should see "Ração E2E"

  @MON-03
  Scenario: An expense needs a positive amount
    Given I am signed in as the owner
    When I open "/expenses"
    And I click the button "Nova despesa"
    And I choose the expense category "Veterinário"
    And I fill "Valor (MT)" with "0"
    And I click the button "Registar despesa"
    Then the sheet should show the error "Indique um valor numérico maior que zero."

  @rbac @MON-04
  Scenario: The investor can read but not record movements
    Given I am signed in as the investor
    When I open "/expenses"
    Then I should see the heading "Despesas"
    And I should not see the button "Nova despesa"

  @MON-05
  Scenario: The expense sheet only records expenses
    Given I am signed in as the owner
    When I open "/expenses"
    And I click the button "Nova despesa"
    Then the sheet "Nova despesa" should be open
    And I should see the button "Registar despesa"
    But I should not see the button "Receita"

  @MON-06
  Scenario: The money page defaults to this month and offers the date presets
    Given I am signed in as the owner
    When I open "/expenses"
    Then I should see the button "Este mês"
    When I choose the report period "Mês passado"
    Then I should be on a page whose URL contains "period=last-month"
    When I choose the report period "Desde o início até hoje"
    Then I should be on a page whose URL contains "period=all-time"

  @MON-07
  Scenario: An expense in a stock category must name the stock item
    Given I am signed in as the owner
    When I open "/expenses"
    And I click the button "Nova despesa"
    And I choose the expense category "Ração"
    And I fill "Quantidade (sacos)" with "2"
    And I click the button "Registar despesa"
    Then the sheet should show the error "Escolha o artigo de stock desta despesa, ou crie um novo."

  @mutation @MON-08
  Scenario: Create a new stock item while recording its purchase
    Given I am signed in as the owner
    When I open "/expenses"
    And I click the button "Nova despesa"
    And I choose the expense category "Ração"
    And I select "+ Criar novo artigo" in "Artigo de stock"
    And I fill "Nome do novo artigo" with "Ração Pré-inicial E2E"
    And I fill "Quantidade (sacos)" with "3"
    And I fill "Preço por sacos (MT)" with "700"
    And I click the button "Registar despesa"
    Then I should see the toast "Despesa registada"
    When I go to "Stock" in the main navigation
    Then I should see "Ração Pré-inicial E2E"
    And I should see "3 sacos"
