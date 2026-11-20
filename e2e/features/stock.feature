@stock
Feature: Stock
  In order to know what feed, medicine and materials the farm has
  As a farm member
  I need to register items and record entries, exits and counts with a history

  @smoke @STK-01
  Scenario: The owner opens the stock page from the main navigation
    Given I am signed in as the owner
    Then I should see the main navigation item "Stock"
    When I open "/stock"
    Then I should see the heading "Stock"
    And I should see "Ração de crescimento"
    And I should see the button "Registar artigo"
    And I should see the button "Registar movimento"

  @rbac @STK-02
  Scenario: The caretaker records movements but does not register items
    Given I am signed in as the caretaker
    Then I should see the main navigation item "Stock"
    When I open "/stock"
    Then I should see the button "Registar movimento"
    But I should not see the button "Registar artigo"

  @STK-03
  Scenario: Record a stock entry
    Given I am signed in as the owner
    When I open "/stock"
    And I click the button "Registar movimento"
    And I select the option starting with "Desinfectante" in "Artigo"
    And I fill "Quantidade (L)" with "3"
    And I select "Doação" in "Motivo"
    And I submit the sheet with "Registar"
    Then I should see "Entrada registada"

  @STK-04
  Scenario: An exit larger than the stock is refused
    Given I am signed in as the owner
    When I open "/stock"
    And I click the button "Registar movimento"
    And I click the tab "Saída"
    And I select the option starting with "Ivermectina" in "Artigo"
    And I fill "Quantidade (frascos)" with "99999"
    And I submit the sheet with "Registar"
    Then the sheet should show an error

  @STK-05
  Scenario: The movement history lists the opening balances
    Given I am signed in as the owner
    When I open "/stock?tab=moves"
    Then I should see "Stock inicial"

  @mutation @STK-06
  Scenario: A purchase entry records the expense at the price of that entry
    Given I am signed in as the owner
    When I open "/stock"
    And I click the button "Registar movimento"
    And I select the option starting with "Desinfectante" in "Artigo"
    And I fill "Quantidade (L)" with "2"
    And I select "Compra" in "Motivo"
    Then I should see "Preço padrão do artigo"
    When I fill "Preço por L (MT)" with "175"
    Then I should see "Padrão: 150 MT"
    And I should see "−350 MT"
    When I fill "Fornecedor" with "Agro-Teste"
    And I submit the sheet with "Registar"
    Then I should see "Compra registada"
    When I open "/expenses"
    Then I should see "Desinfectante · 2 L · Agro-Teste"

  @mutation @STK-07
  Scenario: Register an item: code, unit and validity come from the name, the category and the days
    Given I am signed in as the owner
    When I open "/stock"
    And I click the button "Registar artigo"
    Then I should not see "Código"
    And I should not see "Nota"
    When I fill "Nome" with "Farelo E2E"
    And I select "Ração · sacos" in "Categoria"
    And I fill "Quantidade inicial" with "1"
    Then I should see "saco"
    When I fill "Validade após a compra" with "60"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Artigo registado"
    And I should see "Farelo E2E"
    And I should see "1 saco"
